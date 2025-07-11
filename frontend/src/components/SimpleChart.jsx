import { useState, useEffect, useRef } from 'react'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import { TrendingUp, CandlestickChart } from 'lucide-react'
import { socket } from '../lib/socket';

const SimpleChart = ({ data, currentCrypto, smaPeriod, timeRange, setTimeRange, tradingMode, strategies = [] }) => {
  const [chartData, setChartData] = useState([])
  const [signals, setSignals] = useState([])
  const [crossoverSignals, setCrossoverSignals] = useState([])
  const [isSocketConnected, setIsSocketConnected] = useState(socket.connected)
  const [positionData, setPositionData] = useState(null)

  // Helper function to check if SMA strategy is running
  const isSmaStrategyActive = () => {
    return strategies.some(strategy => strategy.name === 'sma' && strategy.active)
  }

  // Fetch current position and risk management data
  const fetchPositionData = async () => {
    if (!currentCrypto?.id) {
      setPositionData(null)
      return
    }

    try {
      const response = await fetch(`/strategy/position/sma/${currentCrypto.id}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          console.log('[SimpleChart] Position data received:', result)
          setPositionData(result)
        } else {
          console.log('[SimpleChart] No position data:', result)
          setPositionData(null)
        }
      } else {
        console.warn('[SimpleChart] Failed to fetch position data:', response.status)
        setPositionData(null)
      }
    } catch (error) {
      console.error('[SimpleChart] Error fetching position data:', error)
      setPositionData(null)
    }
  }

  useEffect(() => {
    function handleConnect() {
      setIsSocketConnected(true)
      console.log('[SimpleChart] Socket.IO connected:', socket.id)
      console.log('[SimpleChart] 🔥 SOCKET CONNECTED - Will now receive signals')
    }
    function handleDisconnect() {
      setIsSocketConnected(false)
      console.log('[SimpleChart] Socket.IO disconnected')
    }
    function handleAnyEvent(eventName, ...args) {
      console.log('[SimpleChart] 🔥 RAW EVENT RECEIVED:', eventName, args)
      if (eventName === 'signal') {
        console.log('[SimpleChart] 🔥 RAW SIGNAL EVENT RECEIVED:', eventName, args)
      }
    }
    
    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.onAny(handleAnyEvent) // Listen to ALL events
    
    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.offAny(handleAnyEvent)
    }
  }, [])

  // Listen for real-time signal events
  useEffect(() => {
    if (!isSocketConnected) return
    
    function handleSignal(signal) {
      console.log('[SimpleChart] ===================')
      console.log('[SimpleChart] Received signal:', JSON.stringify(signal, null, 2))
      console.log('[SimpleChart] Trading mode:', tradingMode)
      console.log('[SimpleChart] Signal type:', signal.type)
      console.log('[SimpleChart] Signal data:', signal.data)
      console.log('[SimpleChart] Signal productId:', signal.productId || signal.data?.productId)
      
      // Only process signals if trading mode is not stopped
      if (tradingMode === 'stopped') {
        console.log('[SimpleChart] ❌ Ignoring signal - trading is stopped')
        return
      }
      
      // Get current crypto identifier
      const currentCryptoId = currentCrypto?.id || currentCrypto?.symbol || currentCrypto?.productId
      const signalProductId = signal.productId || signal.data?.productId || signal.symbol
      
      console.log('[SimpleChart] Current crypto object:', currentCrypto)
      console.log('[SimpleChart] Current crypto ID:', currentCryptoId)
      console.log('[SimpleChart] Signal product ID:', signalProductId)
      console.log('[SimpleChart] Comparing:', signalProductId, 'vs', currentCryptoId)
      
      // Only add signals for the current crypto product
      if (signalProductId === currentCryptoId) {
        console.log('[SimpleChart] ✅ Adding', signal.type.toUpperCase(), 'signal for current crypto')
        
        // Add timestamp if missing (use current time)
        const signalWithTimestamp = {
          ...signal,
          timestamp: signal.timestamp || new Date().toISOString()
        }
        console.log('[SimpleChart] Signal with timestamp:', signalWithTimestamp)
        
        setSignals(prev => {
          const newSignals = [...prev, signalWithTimestamp]
          console.log('[SimpleChart] Total signals now:', newSignals.length)
          console.log('[SimpleChart] Buy signals:', newSignals.filter(s => s.type === 'buy').length)
          console.log('[SimpleChart] Sell signals:', newSignals.filter(s => s.type === 'sell').length)
          console.log('[SimpleChart] Last 5 signals:', newSignals.slice(-5).map(s => ({ type: s.type, timestamp: s.timestamp, price: s.data?.price })))
          return newSignals
        })
      } else {
        console.log('[SimpleChart] ❌ Ignoring', signal.type, 'signal for different crypto')
      }
      console.log('[SimpleChart] ===================')
    }
    
    console.log('[SimpleChart] Registering signal handler for crypto:', currentCrypto?.id, 'trading mode:', tradingMode)
    socket.on('signal', handleSignal)
    
    return () => {
      console.log('[SimpleChart] Unregistering signal handler')
      socket.off('signal', handleSignal)
    }
  }, [isSocketConnected, currentCrypto, tradingMode])

  // Listen for real-time crossover events (for grey markers)
  useEffect(() => {
    if (!isSocketConnected) return
    
    function handleCrossover(crossoverSignal) {
      console.log('[SimpleChart] Received crossover signal:', crossoverSignal)
      
      // Get current crypto identifier
      const currentCryptoId = currentCrypto?.id || currentCrypto?.symbol || currentCrypto?.productId
      const signalProductId = crossoverSignal.productId || crossoverSignal.data?.productId || crossoverSignal.symbol
      
      // Only add crossover signals for the current crypto product
      if (signalProductId === currentCryptoId) {
        console.log('[SimpleChart] ✅ Adding crossover signal for current crypto')
        
        const crossoverWithTimestamp = {
          ...crossoverSignal,
          timestamp: crossoverSignal.timestamp || new Date().toISOString()
        }
        
        setCrossoverSignals(prev => [...prev, crossoverWithTimestamp])
      }
    }
    
    console.log('[SimpleChart] Registering crossover handler for crypto:', currentCrypto?.id)
    socket.on('crossover', handleCrossover)
    
    return () => {
      console.log('[SimpleChart] Unregistering crossover handler')
      socket.off('crossover', handleCrossover)
    }
  }, [isSocketConnected, currentCrypto])

  // Process data for chart including signals
  useEffect(() => {
    if (!data || data.length === 0) {
      setChartData([])
      return
    }
    
    // Calculate SMA only if SMA strategy is active and we have enough data
    const period = smaPeriod || 20
    const shouldShowSMA = isSmaStrategyActive()
    
    // Convert dates to numbers if needed
    const processedData = data.map(item => ({
      ...item,
      timestamp: typeof item.timestamp === 'number' ? item.timestamp : new Date(item.timestamp).getTime()
    }));
    
    // Sort by timestamp
    processedData.sort((a, b) => a.timestamp - b.timestamp);
    
    // Filter data based on selected time range
    const now = Date.now();
    let filteredData = processedData;
    if (timeRange !== 'all') {
      const timeRangeMap = {
        '1h': 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000
      };
      const timeWindow = timeRangeMap[timeRange];
      filteredData = processedData.filter(item => now - item.timestamp < timeWindow);
    }
    
    // Calculate SMAs on filtered data only if strategy is active
    if (filteredData.length > 0) {
      let withSMA;
      
      if (shouldShowSMA) {
        const prices = filteredData.map(d => d.price);
        const sma = calculateSMA(prices, period);
        
        // Add SMA to chart data
        withSMA = filteredData.map((item, index) => ({
          ...item,
          sma: index >= period - 1 ? sma[index - (period - 1)] : null
        }));
      } else {
        // Don't calculate SMA when strategy is not active
        withSMA = filteredData.map(item => ({
          ...item,
          sma: null
        }));
      }
      
      // Add signal data points at their exact timestamps
      const currentCryptoId = currentCrypto?.id || currentCrypto?.symbol || currentCrypto?.productId;
      const relevantSignals = signals.filter(s => {
        const signalProductId = s.productId || s.product_id || s.symbol;
        return signalProductId === currentCryptoId;
      });
      
      console.log('[SimpleChart] Total signals for crypto:', relevantSignals.length);
      console.log('[SimpleChart] Buy signals:', relevantSignals.filter(s => s.type === 'buy').length);
      console.log('[SimpleChart] Sell signals:', relevantSignals.filter(s => s.type === 'sell').length);
      console.log('[SimpleChart] All signals:', relevantSignals.map(s => ({ type: s.type, timestamp: s.timestamp, price: s.data?.price })));
      
      // Create separate data points for signals
      const signalDataPoints = relevantSignals.map(signal => {
        console.log('[SimpleChart] Creating signal data point:', {
          type: signal.type,
          timestamp: signal.timestamp,
          price: signal.data?.price
        });
        
        const dataPoint = {
          timestamp: new Date(signal.timestamp).getTime(),
          price: signal.data.price,
          sma: null, // Don't calculate SMA for signal points
          buySignal: signal.type === 'buy' ? signal.data.price : null,
          sellSignal: signal.type === 'sell' ? signal.data.price : null,
          isSignalPoint: true
        };
        
        console.log('[SimpleChart] Signal data point created:', dataPoint);
        return dataPoint;
      });

      // Create separate data points for crossover signals (grey markers)
      const relevantCrossoverSignals = crossoverSignals.filter(s => {
        const signalProductId = s.productId || s.product_id || s.symbol;
        return signalProductId === currentCryptoId;
      });

      const crossoverDataPoints = relevantCrossoverSignals.map(crossover => {
        console.log('[SimpleChart] Creating crossover data point:', {
          direction: crossover.direction,
          timestamp: crossover.timestamp,
          price: crossover.data?.price
        });
        
        const dataPoint = {
          timestamp: new Date(crossover.timestamp).getTime(),
          price: crossover.data.price,
          sma: null,
          // Create separate fields for buy and sell crossovers for color-coding
          buyCrossover: crossover.direction === 'BUY' ? crossover.data.price : null,
          sellCrossover: crossover.direction === 'SELL' ? crossover.data.price : null,
          crossoverDirection: crossover.direction, // 'BUY' or 'SELL' direction
          isCrossoverPoint: true
        };
        
        return dataPoint;
      });
      
      // Merge regular data with signal data points and crossover points, then sort by timestamp  
      const allDataPoints = [...withSMA, ...signalDataPoints, ...crossoverDataPoints];
      allDataPoints.sort((a, b) => a.timestamp - b.timestamp);
      
      console.log('[SimpleChart] Final chart data points with signals:', allDataPoints.filter(p => p.buySignal || p.sellSignal).length);
      console.log('[SimpleChart] Buy signal points:', allDataPoints.filter(p => p.buySignal).length);
      console.log('[SimpleChart] Sell signal points:', allDataPoints.filter(p => p.sellSignal).length);
      console.log('[SimpleChart] Buy crossover points:', allDataPoints.filter(p => p.buyCrossover).length);
      console.log('[SimpleChart] Sell crossover points:', allDataPoints.filter(p => p.sellCrossover).length);
      
      setChartData(allDataPoints);
    } else {
      setChartData(filteredData);
    }
  }, [data, timeRange, smaPeriod, signals, crossoverSignals, currentCrypto, strategies, positionData]);
  
  // Clear signals when crypto changes
  useEffect(() => {
    console.log('[SimpleChart] Crypto changed, clearing signals and crossovers')
    setSignals([])
    setCrossoverSignals([])
  }, [currentCrypto?.id])
  
  // Clear signals only when starting a new trading/simulation session
  // NOT when stopping - this allows users to review past trades
  const previousMode = useRef(tradingMode)
  useEffect(() => {
    // Only clear trade signals when transitioning FROM stopped TO active/simulation
    if (previousMode.current === 'stopped' && (tradingMode === 'active' || tradingMode === 'simulation')) {
      console.log('[SimpleChart] Starting new trading session, clearing old trade signals')
      setSignals([])
    }
    
    previousMode.current = tradingMode
  }, [tradingMode])
  
  // Clear crossover signals when SMA strategy is stopped
  useEffect(() => {
    if (!isSmaStrategyActive()) {
      console.log('[SimpleChart] SMA strategy stopped, clearing crossover signals')
      setCrossoverSignals([])
    }
  }, [strategies])
  
  // Fetch position data when crypto, trading mode, or strategies change
  useEffect(() => {
    fetchPositionData()
    
    // Set up interval to refresh position data every 5 seconds
    // More frequent updates when trading is active
    const updateInterval = (tradingMode === 'simulation' || tradingMode === 'active') ? 5000 : 15000
    const interval = setInterval(fetchPositionData, updateInterval)
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [currentCrypto?.id, tradingMode, strategies])
  
  // Debug effect to log position data changes
  useEffect(() => {
    console.log('[SimpleChart] Position data changed:', {
      hasPositionData: !!positionData,
      position: positionData?.position,
      hasRiskManagement: !!positionData?.riskManagement,
      stopLossPrice: positionData?.riskManagement?.stopLossPrice,
      takeProfitPrice: positionData?.riskManagement?.takeProfitPrice,
      shouldShowStopLoss: positionData?.position === 'long' && positionData?.riskManagement?.stopLossPrice,
      shouldShowTakeProfit: positionData?.position === 'long' && positionData?.riskManagement?.takeProfitPrice
    })
  }, [positionData])

  // Helper function to calculate Simple Moving Average
  const calculateSMA = (prices, period) => {
    const result = [];
    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
    return result;
  };
  
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const formatPrice = (price) => {
    if (!price || !currentCrypto) return '$0.00';
    
    // Different decimal places for different cryptocurrencies
    let decimals = 2;
    switch (currentCrypto.symbol) {
      case 'BTC':
        decimals = 0;
        break;
      case 'ETH':
        decimals = 2;
        break;
      case 'ADA':
        decimals = 4;
        break;
      case 'SOL':
      case 'DOT':
        decimals = 2;
        break;
      case 'MATIC':
      case 'AVAX':
        decimals = 3;
        break;
      default:
        decimals = 2;
    }
    
    return `$${price.toFixed(decimals)}`;
  };
  
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      
      return (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
          <p className="text-gray-300">{`Time: ${formatTime(label)}`}</p>
          <p className="text-white font-semibold">{`Price: ${formatPrice(payload[0]?.value)}`}</p>
          {isSmaStrategyActive() && payload.find(p => p.dataKey === 'sma')?.value && (
            <p className="text-green-400 font-semibold">{`SMA: ${formatPrice(payload.find(p => p.dataKey === 'sma')?.value)}`}</p>
          )}
          {data?.stopLossLine && (
            <p className="text-red-400 font-semibold">{`Stop Loss: ${formatPrice(data.stopLossLine)}`}</p>
          )}
          {data?.takeProfitLine && (
            <p className="text-green-400 font-semibold">{`Take Profit: ${formatPrice(data.takeProfitLine)}`}</p>
          )}
          {data?.buySignal && (
            <p className="text-green-500 font-bold">🟢 BUY SIGNAL</p>
          )}
          {data?.sellSignal && (
            <p className="text-red-500 font-bold">🔴 SELL SIGNAL</p>
          )}
          {data?.buyCrossover && (
            <p className="text-green-400 font-medium">📈 BUY Crossover</p>
          )}
          {data?.sellCrossover && (
            <p className="text-red-400 font-medium">📉 SELL Crossover</p>
          )}
        </div>
      );
    }
    return null;
  };
  
  // Time range selector buttons
  const timeRangeButtons = [
    { label: '1H', value: '1h' },
    { label: '6H', value: '6h' },
    { label: '24H', value: '24h' },
    { label: 'All', value: 'all' }
  ];
  
  return (
    <div className="space-y-4">
      {/* Trading Mode Status Bar */}
      <div className={`rounded-lg px-6 py-4 border-l-4 ${
        tradingMode === 'stopped' 
          ? 'bg-gray-800 border-gray-500' 
          : tradingMode === 'simulation' 
          ? 'bg-blue-900/30 border-blue-500' 
          : 'bg-green-900/30 border-green-500'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${
              tradingMode === 'stopped' 
                ? 'bg-gray-500' 
                : tradingMode === 'simulation' 
                ? 'bg-blue-500 animate-pulse' 
                : 'bg-green-500 animate-pulse'
            }`}></div>
            <div>
              <h3 className={`font-semibold text-lg ${
                tradingMode === 'stopped' 
                  ? 'text-gray-300' 
                  : tradingMode === 'simulation' 
                  ? 'text-blue-300' 
                  : 'text-green-300'
              }`}>
                {tradingMode === 'stopped' && 'Trading Stopped'}
                {tradingMode === 'simulation' && 'Simulation Mode'}
                {tradingMode === 'active' && 'Live Trading Active'}
              </h3>
              <p className="text-sm text-gray-400">
                {tradingMode === 'stopped' && 'No strategies are running. Start a strategy to begin trading.'}
                {tradingMode === 'simulation' && 'Virtual trading with paper money. No real funds at risk.'}
                {tradingMode === 'active' && 'Real trading with actual funds. Monitor carefully!'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">Signals</div>
            <div className="font-mono text-lg">
              <span className="text-green-400">{signals.filter(s => s.type === 'buy').length} BUY</span>
              <span className="text-gray-500 mx-2">|</span>
              <span className="text-red-400">{signals.filter(s => s.type === 'sell').length} SELL</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white flex items-center">
            <CandlestickChart className="h-5 w-5 mr-2 text-blue-500" />
            {currentCrypto ? `${currentCrypto.name} Chart` : 'Price Chart'}
          </h2>
          <div className="flex items-center space-x-2">
            {timeRangeButtons.map(button => (
              <button
                key={button.value}
                className={`px-3 py-1 rounded text-sm ${
                  timeRange === button.value 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
                onClick={() => setTimeRange(button.value)}
              >
                {button.label}
              </button>
            ))}
          </div>
        </div>
      
      <div className="h-80">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="timestamp"
                tickFormatter={formatTime}
                stroke="#9CA3AF"
                fontSize={12}
              />
              <YAxis 
                domain={(() => {
                  // Calculate Y-axis domain, optionally including risk management prices if they exist
                  let minPrice = 'auto';
                  let maxPrice = 'auto';
                  
                  if (positionData?.riskManagement && positionData?.position === 'long') {
                    const { stopLossPrice, takeProfitPrice } = positionData.riskManagement;
                    const chartPrices = chartData.map(d => d.price).filter(p => p && !isNaN(p));
                    
                    if (chartPrices.length > 0 && (stopLossPrice || takeProfitPrice)) {
                      const dataMin = Math.min(...chartPrices);
                      const dataMax = Math.max(...chartPrices);
                      
                      minPrice = Math.min(dataMin, stopLossPrice || dataMin, takeProfitPrice || dataMin) * 0.995;
                      maxPrice = Math.max(dataMax, stopLossPrice || dataMax, takeProfitPrice || dataMax) * 1.005;
                      
                      console.log('[SimpleChart] Y-axis domain calculated with risk management:', {
                        dataMin, dataMax, stopLossPrice, takeProfitPrice, minPrice, maxPrice
                      });
                    }
                  }
                  
                  return [minPrice, maxPrice];
                })()}
                tickFormatter={formatPrice}
                stroke="#9CA3AF"
                fontSize={12}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="price" 
                name="Price" 
                stroke="#f59e0b" 
                activeDot={{ r: 4 }}
                dot={false}
                strokeWidth={2}
              />
              {/* Only show SMA line when SMA strategy is active */}
              {isSmaStrategyActive() && (
                <Line 
                  type="monotone" 
                  dataKey="sma" 
                  name={`SMA (${smaPeriod})`} 
                  stroke="#22c55e" 
                  dot={false}
                  strokeWidth={2}
                />
              )}
              {/* Buy signals as line with dots only where signals exist */}
              <Line 
                type="monotone" 
                dataKey="buySignal" 
                name="Buy Signal" 
                stroke="transparent"
                dot={{ fill: '#22c55e', stroke: '#fff', strokeWidth: 3, r: 10 }}
                connectNulls={false}
                strokeWidth={0}
              />
              {/* Sell signals as line with dots only where signals exist */}
              <Line 
                type="monotone" 
                dataKey="sellSignal" 
                name="Sell Signal" 
                stroke="transparent"
                dot={{ fill: '#ef4444', stroke: '#fff', strokeWidth: 3, r: 10 }}
                connectNulls={false}
                strokeWidth={0}
              />
              {/* Crossover signals as small colored dots with half opacity */}
              {/* Buy crossovers - light green with half opacity */}
              <Line 
                type="monotone" 
                dataKey="buyCrossover" 
                name="Buy Crossover" 
                stroke="transparent"
                dot={{ fill: '#22c55e', fillOpacity: 0.5, stroke: '#16a34a', strokeWidth: 1, r: 4 }}
                connectNulls={false}
                strokeWidth={0}
              />
              {/* Sell crossovers - light red with half opacity */}
              <Line 
                type="monotone" 
                dataKey="sellCrossover" 
                name="Sell Crossover" 
                stroke="transparent"
                dot={{ fill: '#ef4444', fillOpacity: 0.5, stroke: '#dc2626', strokeWidth: 1, r: 4 }}
                connectNulls={false}
                strokeWidth={0}
              />
              {/* Stop-loss line - show whenever we have position data with stop-loss */}
              {positionData?.position === 'long' && 
               positionData?.riskManagement?.stopLossPrice && (
                <ReferenceLine 
                  y={positionData.riskManagement.stopLossPrice}
                  stroke="#ef4444" 
                  strokeDasharray="5 5"
                  strokeWidth={2}
                />
              )}
              {/* Take-profit line - show whenever we have position data with take-profit */}
              {positionData?.position === 'long' && 
               positionData?.riskManagement?.takeProfitPrice && (
                <ReferenceLine 
                  y={positionData.riskManagement.takeProfitPrice}
                  stroke="#22c55e" 
                  strokeDasharray="5 5"
                  strokeWidth={2}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-80 text-gray-400">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Waiting for price data...</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Position and Stop-Loss Info */}
      {positionData?.position === 'long' && positionData?.riskManagement && (
        <div className="mt-4 p-3 bg-gray-800/50 border border-gray-600 rounded text-sm">
          <div className="text-yellow-400 font-medium">LONG Position Active</div>
          <div className="grid grid-cols-3 gap-4 mt-2">
            <div className="text-gray-400">
              <span className="text-xs text-gray-500">Entry:</span><br />
              {formatPrice(positionData.riskManagement.entryPrice)}
            </div>
            {positionData.riskManagement.stopLossPrice && (
              <div className="text-red-400">
                <span className="text-xs text-gray-500">Stop Loss:</span><br />
                {formatPrice(positionData.riskManagement.stopLossPrice)}
              </div>
            )}
            {positionData.riskManagement.takeProfitPrice && (
              <div className="text-green-400">
                <span className="text-xs text-gray-500">Take Profit:</span><br />
                {formatPrice(positionData.riskManagement.takeProfitPrice)}
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default SimpleChart;

// Socket connection error handling
socket.on('connect_error', (err) => {
  console.error('[SimpleChart] Socket.IO connect_error:', err)
});
socket.on('error', (err) => {
  console.error('[SimpleChart] Socket.IO error:', err)
});
