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

const PriceChart = ({ data, currentCrypto }) => {
  const [chartData, setChartData] = useState([])
  const [timeRange, setTimeRange] = useState('1h')
  
  // Process data for chart
  useEffect(() => {
    if (!data || data.length === 0) {
      console.log('No data available for chart');
      return;
    }
    
    console.log('Processing chart data, points:', data.length);
    
    // Calculate SMA if we have enough data
    const shortPeriod = 7;
    const longPeriod = 21;
    
    // Convert dates to numbers if needed
    const processedData = data.map(item => ({
      ...item,
      timestamp: typeof item.timestamp === 'number' ? item.timestamp : new Date(item.timestamp).getTime()
    }));
    
    // Sort by timestamp
    processedData.sort((a, b) => a.timestamp - b.timestamp);
    
    // Calculate SMAs
    const prices = processedData.map(d => d.price);
    const shortSMA = calculateSMA(prices, shortPeriod);
    const longSMA = calculateSMA(prices, longPeriod);
    
    // Add SMA to chart data
    const withSMA = processedData.map((item, index) => ({
      ...item,
      shortSMA: index >= shortPeriod - 1 ? shortSMA[index - (shortPeriod - 1)] : null,
      longSMA: index >= longPeriod - 1 ? longSMA[index - (longPeriod - 1)] : null
    }));
    
    setChartData(withSMA);
  }, [data]);
  
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
      return (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
          <p className="text-gray-300">{`Time: ${formatTime(label)}`}</p>
          <p className="text-white font-semibold">{`Price: ${formatPrice(payload[0]?.value)}`}</p>
          {payload[1]?.value && (
            <p className="text-green-400 font-semibold">{`Short SMA: ${formatPrice(payload[1]?.value)}`}</p>
          )}
          {payload[2]?.value && (
            <p className="text-blue-400 font-semibold">{`Long SMA: ${formatPrice(payload[2]?.value)}`}</p>
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
                dataKey="shortSMA" 
                name="Short SMA" 
                stroke="#22c55e" 
                dot={false}
                strokeWidth={2}
              />
              <Line 
                type="monotone" 
                dataKey="longSMA" 
                name="Long SMA" 
                stroke="#3b82f6" 
                dot={false}
                strokeWidth={2}
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

export default PriceChart;
                type="monotone" 
                dataKey="shortSMA" 
                name="Short SMA"
                stroke="#22c55e" 
                dot={false}
                strokeWidth={2}
                activeDot={false}
              />
              <Line 
                type="monotone" 
                dataKey="longSMA"
                name="Long SMA" 
                stroke="#3b82f6" 
                dot={false}
                strokeWidth={2}
                activeDot={false}
              />
            </ComposedChart>
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
  )
}

export default PriceChart
