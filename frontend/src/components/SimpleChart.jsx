import { useState, useEffect } from 'react'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer
} from 'recharts'
import { TrendingUp, CandlestickChart } from 'lucide-react'
import { socket } from '../lib/socket';

const SimpleChart = ({ data, currentCrypto, smaPeriod, timeRange, setTimeRange, tradingMode }) => {
  const [chartData, setChartData] = useState([])
  const [signals, setSignals] = useState([])
  const [isSocketConnected, setIsSocketConnected] = useState(socket.connected)

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

  // Process data for chart including signals
  useEffect(() => {
    if (!data || data.length === 0) {
      setChartData([])
      return
    }
    
    // Calculate SMA if we have enough data
    const period = smaPeriod || 20
    
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
    
    // Calculate SMAs on filtered data
    if (filteredData.length > 0) {
      const prices = filteredData.map(d => d.price);
      const sma = calculateSMA(prices, period);
      
      // Add SMA to chart data
      const withSMA = filteredData.map((item, index) => ({
        ...item,
        sma: index >= period - 1 ? sma[index - (period - 1)] : null
      }));
      
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
      
      // Merge regular data with signal data points and sort by timestamp
      const allDataPoints = [...withSMA, ...signalDataPoints];
      allDataPoints.sort((a, b) => a.timestamp - b.timestamp);
      
      console.log('[SimpleChart] Final chart data points with signals:', allDataPoints.filter(p => p.buySignal || p.sellSignal).length);
      console.log('[SimpleChart] Buy signal points:', allDataPoints.filter(p => p.buySignal).length);
      console.log('[SimpleChart] Sell signal points:', allDataPoints.filter(p => p.sellSignal).length);
      
      setChartData(allDataPoints);
    } else {
      setChartData(filteredData);
    }
  }, [data, timeRange, smaPeriod, signals, currentCrypto]);
  
  // Clear signals when crypto changes
  useEffect(() => {
    console.log('[SimpleChart] Crypto changed, clearing signals')
    setSignals([])
  }, [currentCrypto?.id])
  
  // Clear signals when trading mode changes to stopped
  useEffect(() => {
    if (tradingMode === 'stopped') {
      console.log('[SimpleChart] Trading stopped, clearing signals')
      setSignals([])
    }
  }, [tradingMode])
  
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
          {payload.find(p => p.dataKey === 'sma')?.value && (
            <p className="text-green-400 font-semibold">{`SMA: ${formatPrice(payload.find(p => p.dataKey === 'sma')?.value)}`}</p>
          )}
          {data?.buySignal && (
            <p className="text-green-500 font-bold">🟢 BUY SIGNAL</p>
          )}
          {data?.sellSignal && (
            <p className="text-red-500 font-bold">🔴 SELL SIGNAL</p>
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
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white flex items-center">
          <CandlestickChart className="h-5 w-5 mr-2 text-blue-500" />
          {currentCrypto ? `${currentCrypto.name} Chart` : 'Price Chart'}
          <span className="ml-4 text-sm text-gray-400">
            {tradingMode === 'stopped' && '(Stopped)'}
            {tradingMode === 'simulation' && `(Simulation - ${signals.filter(s => s.type === 'buy').length} buy, ${signals.filter(s => s.type === 'sell').length} sell)`}
            {tradingMode === 'active' && `(Active Trading - ${signals.filter(s => s.type === 'buy').length} buy, ${signals.filter(s => s.type === 'sell').length} sell)`}
          </span>
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
                domain={['auto', 'auto']}
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
              <Line 
                type="monotone" 
                dataKey="sma" 
                name={`SMA (${smaPeriod})`} 
                stroke="#22c55e" 
                dot={false}
                strokeWidth={2}
              />
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
