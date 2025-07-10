import { useState, useEffect, useRef } from 'react'
import { Activity, TrendingUp, TrendingDown, DollarSign, Wallet, ChevronDown, Bitcoin } from 'lucide-react'
import { io } from 'socket.io-client'
import SimpleChart from './components/SimpleChart'
import StrategyControls from './components/StrategyControls'
import LogViewer from './components/LogViewer'
import Portfolio from './components/Portfolio'
import { useApi } from './hooks/useSocket'
import { socket } from './lib/socket'

const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'

function App() {
  const [botStatus, setBotStatus] = useState(null)
  const [priceData, setPriceData] = useState([])
  const [currentPrice, setCurrentPrice] = useState(null)
  const [portfolio, setPortfolio] = useState({})
  const [allPrices, setAllPrices] = useState({})
  const [logs, setLogs] = useState([])
  const [trades, setTrades] = useState([])
  const [strategies, setStrategies] = useState([])
  const [isConnected, setIsConnected] = useState(false)
  const [selectedCrypto, setSelectedCrypto] = useState('BTC-USD')
  const [cryptoDropdownOpen, setCryptoDropdownOpen] = useState(false)
  const [smaPeriod, setSmaPeriod] = useState(20)
  const [timeRange, setTimeRange] = useState('1h')
  const [availableCryptos, setAvailableCryptos] = useState([])
  const [tradingMode, setTradingMode] = useState('stopped')

  const { fetchData, postData } = useApi()

  // Fetch available cryptos from backend
  useEffect(() => {
    const fetchCryptos = async () => {
      try {
        const result = await fetchData('/cryptos')
        if (result.cryptos && result.cryptos.length > 0) {
          setAvailableCryptos(result.cryptos)
        } else {
          setAvailableCryptos([{ id: 'BTC-USD', name: 'Bitcoin', symbol: 'BTC', icon: '₿' }])
        }
      } catch (e) {
        setAvailableCryptos([{ id: 'BTC-USD', name: 'Bitcoin', symbol: 'BTC', icon: '₿' }])
      }
    }
    fetchCryptos()
  }, [])

  // Get current crypto details
  const currentCrypto = availableCryptos.find(crypto => crypto.id === selectedCrypto) || availableCryptos[0] || { id: 'BTC-USD', name: 'Bitcoin', symbol: 'BTC', icon: '₿' }

  // Helper function to format price based on cryptocurrency
  const formatPrice = (price) => {
    if (!price) return '0.00'
    
    // Different decimal places for different cryptocurrencies
    switch (currentCrypto.symbol) {
      case 'BTC':
      case 'ETH':
        return price.toFixed(2)
      case 'ADA':
        return price.toFixed(4)
      case 'SOL':
      case 'DOT':
      case 'LINK':
        return price.toFixed(2)
      case 'MATIC':
      case 'AVAX':
        return price.toFixed(3)
      default:
        return price.toFixed(2)
    }
  }

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const status = await fetchData('/status')
        setBotStatus(status)
        setStrategies(status.strategies || [])
        setPortfolio(status.portfolio || {}) // Use empty object as fallback
        setAllPrices(status.allPrices || {})
        setCurrentPrice(status.lastPrice || 0) // Use 0 as fallback
        setIsConnected(true)
      } catch (error) {
        console.error('Failed to fetch initial data:', error)
        setIsConnected(false)
      }
    }

    fetchInitialData()
  }, [])

  // Set up Socket.IO connection for real-time updates
  useEffect(() => {
    function handleConnect() {
      console.log('Connected to Socket.IO');
      setIsConnected(true);
    }
    function handleDisconnect() {
      console.log('Disconnected from Socket.IO');
      setIsConnected(false);
    }
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('price-update', (data) => {
      // Only update chart if the price update is for the selected crypto
      if (data.productId === selectedCryptoRef.current) {
        setCurrentPrice(data.price)
        setPriceData(prev => {
          const newPoint = {
            time: data.timestamp,
            price: data.price,
            timestamp: new Date(data.timestamp || Date.now()).getTime()
          }
          const newData = [...prev, newPoint]
          const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000)
          const filtered = newData.filter(point => point.timestamp >= twentyFourHoursAgo)
          return filtered
        })
        setLogs(prev => [...prev.slice(-49), {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `Price update: ${data.productId} - $${formatPrice(data.price)}`,
          service: 'websocket'
        }])
      } else {
        // For other products, only update allPrices (for portfolio value), not chart
        setAllPrices(prev => ({ ...prev, [data.productId]: data.price }))
      }
    })
    
    socket.on('portfolio-update', (data) => {
      console.log('Real-time portfolio update:', data)
      setPortfolio(data.portfolio)
      
      // Add a log entry about the portfolio update
      setLogs(prev => [...prev.slice(-49), {
        timestamp: data.timestamp,
        level: 'info',
        message: 'Portfolio updated via real-time sync',
        service: 'trading-engine'
      }])
    })

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('price-update');
      socket.off('portfolio-update');
    };
  }, [])

  // Mock log updates
  useEffect(() => {
    const logInterval = setInterval(() => {
      const mockLogs = [
        { timestamp: new Date().toISOString(), level: 'info', message: `Price update: ${selectedCrypto} - $${formatPrice(currentPrice)}`, service: 'trading-bot' },
        { timestamp: new Date().toISOString(), level: 'debug', message: 'Strategy SMA evaluation completed', service: 'strategy' },
        { timestamp: new Date().toISOString(), level: 'info', message: 'Portfolio balance updated', service: 'trading-engine' }
      ]
      
      setLogs(prev => {
        const randomLog = mockLogs[Math.floor(Math.random() * mockLogs.length)]
        return [...prev.slice(-49), randomLog] // Keep last 50 logs
      })
    }, 3000)

    return () => clearInterval(logInterval)
  }, [currentPrice, selectedCrypto])

  const handleStrategyAction = async (action, strategyName, parameters) => {
    if (strategyName === 'sma' && parameters.period) {
      setSmaPeriod(parameters.period)
    }

    try {
      const endpoint = action === 'start' ? '/strategy/start' : '/strategy/stop'
      const result = await postData(endpoint, { strategyName, parameters })
      
      // Add trade log
      if (result.success) {
        setTrades(prev => [...prev.slice(-19), {
          id: Date.now(),
          timestamp: new Date().toISOString(),
          strategy: strategyName,
          action: action,
          status: 'success',
          message: result.message
        }])
      }
      
      // Refresh status
      const status = await fetchData('/status')
      setBotStatus(status)
      setStrategies(status.strategies || [])
    } catch (error) {
      console.error('Strategy action failed:', error)
      setTrades(prev => [...prev.slice(-19), {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        strategy: strategyName,
        action: action,
        status: 'error',
        message: error.message
      }])
    }
  }

  const handleCryptoSelect = async (id) => {
    console.log(`Switching to cryptocurrency: ${id}`)
    setSelectedCrypto(id)
    setCryptoDropdownOpen(false)
    
    // Clear existing data immediately
    setPriceData([])
    setCurrentPrice(null)
    
    try {
      // Fetch price data for the selected cryptocurrency
      const response = await fetchData(`/price/${id}?limit=1000`) // Request more historical data
      console.log(`Received price data for ${id}:`, response)
      
      if (response.price) {
        setCurrentPrice(response.price)
      }
      
      // Update price history if available
      if (response.history && response.history.length > 0) {
        // Process all historical data points
        const formattedHistory = response.history.map(item => ({
          time: item.timestamp,
          price: item.price,
          timestamp: new Date(item.timestamp).getTime()
        }))
        setPriceData(formattedHistory)
        console.log(`Updated price history for ${id}: ${formattedHistory.length} points (unfiltered)`)
      }
      
      // Update backend subscriptions to focus on this cryptocurrency
      await postData('/subscriptions', { productIds: [id] })
      console.log(`Updated backend subscription to ${id}`)
      
    } catch (error) {
      console.error('Error switching cryptocurrency:', error)
    }
  }

  // Load price data when cryptocurrency selection changes
  useEffect(() => {
    const loadCryptoData = async () => {
      if (selectedCrypto) {
        try {
          const response = await fetchData(`/price/${selectedCrypto}?limit=1000`)
          if (response.price) {
            setCurrentPrice(response.price)
          }
          if (response.history && response.history.length > 0) {
            // Process historical data points
            const formattedHistory = response.history.map(item => ({
              time: item.timestamp,
              price: item.price,
              timestamp: new Date(item.timestamp).getTime()
            }))
            setPriceData(formattedHistory)
            console.log(`Loaded price history: ${formattedHistory.length} points (unfiltered)`)
          }
        } catch (error) {
          console.error('Error loading crypto data:', error)
        }
      }
    }
    
    loadCryptoData()
  }, [selectedCrypto, fetchData])

  // Periodic portfolio refresh
  useEffect(() => {
    const portfolioInterval = setInterval(async () => {
      try {
        const status = await fetchData('/status')
        if (status.portfolio) {
          setPortfolio(status.portfolio)
        }
        if (status.allPrices) {
          setAllPrices(status.allPrices)
        }
      } catch (error) {
        console.error('Failed to refresh portfolio:', error)
      }
    }, 30000) // Refresh every 30 seconds

    return () => clearInterval(portfolioInterval)
  }, [])

  const priceChange = priceData.length > 1 ? 
    priceData[priceData.length - 1].price - priceData[priceData.length - 2].price : 0
  const priceChangePercent = priceData.length > 1 ? 
    ((priceChange / priceData[priceData.length - 2].price) * 100) : 0

  // Ref for selected cryptocurrency
  const selectedCryptoRef = useRef(selectedCrypto);
  useEffect(() => {
    selectedCryptoRef.current = selectedCrypto;
  }, [selectedCrypto]);

  // Only show nonzero, non-fiat crypto holdings in selector
  const heldCryptos = availableCryptos.filter(crypto => {
    const symbol = crypto.symbol;
    return symbol !== 'USD' && symbol !== 'USDC' && portfolio[symbol] && portfolio[symbol] > 0;
  });
  // Use heldCryptos for selector, fallback to BTC-USD if none
  const selectorCryptos = heldCryptos.length > 0 ? heldCryptos : availableCryptos.filter(c => c.symbol !== 'USD' && c.symbol !== 'USDC');

  // For holdings count, only count nonzero, non-fiat cryptos
  const holdingsCount = Object.entries(portfolio || {}).filter(([currency, amount]) => amount > 0 && currency !== 'USD' && currency !== 'USDC').length;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Bitcoin className="h-8 w-8 text-orange-500" />
            <h1 className="text-2xl font-bold text-white">DutchessAI Trading Bot</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className={`flex items-center space-x-2 ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
              <Activity className="h-5 w-5" />
              <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
            <div className="text-sm text-gray-400">
              {botStatus?.bot === 'active' ? 'Bot Active' : 'Bot Inactive'}
            </div>
            {/* Crypto Selector */}
            <div className="relative">
              <button 
                onClick={() => setCryptoDropdownOpen(!cryptoDropdownOpen)} 
                className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-md focus:outline-none"
              >
                <span className="text-lg">{currentCrypto.icon} {currentCrypto.symbol}</span>
                <ChevronDown className="h-5 w-5" />
              </button>
              {cryptoDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-md shadow-lg z-10">
                  {selectorCryptos.map(crypto => (
                    <button 
                      key={crypto.id} 
                      onClick={() => handleCryptoSelect(crypto.id)} 
                      className="flex items-center justify-between w-full px-4 py-2 text-left text-sm hover:bg-gray-700"
                    >
                      <span className="flex items-center space-x-2">
                        <span className="text-lg">{crypto.icon || '❓'}</span>
                        <span>{crypto.name || crypto.symbol}</span>
                      </span>
                      <span className="text-gray-400">{crypto.symbol}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        {/* Price Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Current Price ({currentCrypto.symbol})</p>
                <p className="text-2xl font-bold text-white">
                  ${formatPrice(currentPrice)}
                </p>
              </div>
              <span className="text-3xl">{currentCrypto.icon}</span>
            </div>
          </div>
          
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">24h Change</p>
                <p className={`text-2xl font-bold ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {priceChange >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%
                </p>
              </div>
              {priceChange >= 0 ? 
                <TrendingUp className="h-8 w-8 text-green-500" /> : 
                <TrendingDown className="h-8 w-8 text-red-500" />
              }
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Portfolio Value</p>
                <p className="text-2xl font-bold text-white">
                  ${Object.entries(portfolio || {}).reduce((total, [currency, amount]) => {
                    if (amount > 0) {
                      if (currency === 'USD' || currency === 'USDC') {
                        return total + amount;
                      } else {
                        const productId = `${currency}-USD`;
                        const price = allPrices?.[productId] || 0;
                        return total + (amount * price);
                      }
                    }
                    return total;
                  }, 0).toFixed(2)}
                </p>
              </div>
              <Wallet className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Holdings Count</p>
                <p className="text-2xl font-bold text-white">
                  {holdingsCount}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </div>
        </div>

        {/* Main Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chart and Portfolio */}
          <div className="lg:col-span-2 space-y-8">
            <SimpleChart 
              data={priceData} 
              currentCrypto={currentCrypto} 
              smaPeriod={smaPeriod} 
              timeRange={timeRange} 
              setTimeRange={setTimeRange}
              tradingMode={tradingMode}
            />
            <Portfolio portfolio={portfolio} allPrices={allPrices} />
          </div>

          {/* Controls and Logs */}
          <div className="space-y-8">
            <StrategyControls 
              strategies={strategies} 
              onStrategyAction={handleStrategyAction}
              onSmaPeriodChange={setSmaPeriod}
              onTradingModeChange={setTradingMode}
              tradingMode={tradingMode}
            />
            <LogViewer logs={logs} trades={trades} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
