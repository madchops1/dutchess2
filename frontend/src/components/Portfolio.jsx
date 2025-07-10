import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react'

const Portfolio = ({ portfolio, allPrices }) => {
  // Cryptocurrency metadata
  const cryptoInfo = {
    BTC: { icon: '₿', color: '#F59E0B', name: 'Bitcoin' },
    ETH: { icon: 'Ξ', color: '#627EEA', name: 'Ethereum' },
    ADA: { icon: '₳', color: '#0033AD', name: 'Cardano' },
    SOL: { icon: '◎', color: '#14F195', name: 'Solana' },
    DOT: { icon: '●', color: '#E6007A', name: 'Polkadot' },
    MATIC: { icon: '⬟', color: '#8247E5', name: 'Polygon' },
    AVAX: { icon: '🔺', color: '#E84142', name: 'Avalanche' },
    LINK: { icon: '🔗', color: '#375BD2', name: 'Chainlink' },
    USD: { icon: '$', color: '#10B981', name: 'US Dollar' },
    USDC: { icon: '$', color: '#2775CA', name: 'USD Coin' }
  }

  // Calculate portfolio data
  const portfolioData = []
  let totalValue = 0
  let holdingsCount = 0

  Object.entries(portfolio || {}).forEach(([currency, amount]) => {
    if (amount > 0 && currency !== 'USD' && currency !== 'USDC') {
      holdingsCount++;
      const info = cryptoInfo[currency] || { icon: '❓', color: '#6B7280', name: currency };
      const productId = `${currency}-USD`;
      const price = allPrices?.[productId] || 1; // Default to 1 if price not found
      const value = amount * price;
      totalValue += value;
      portfolioData.push({
        currency,
        amount,
        value,
        icon: info.icon,
        color: info.color,
        displayName: info.name || currency,
        name: info.name || currency
      });
    }
  })

  // Sort by value (largest first)
  portfolioData.sort((a, b) => b.value - a.value)

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
          <p className="text-white font-semibold">{data.icon} {data.displayName}</p>
          <p className="text-gray-300">{`Value: $${data.value.toFixed(2)}`}</p>
          <p className="text-gray-300">
            {`Amount: ${data.name === 'USD' || data.name === 'USDC' ? 
              data.amount.toFixed(2) : 
              data.amount.toFixed(6)} ${data.name}`}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white flex items-center">
          <Wallet className="h-5 w-5 mr-2 text-blue-500" />
          Portfolio Overview
          <span className="ml-3 text-sm text-gray-400">({holdingsCount} holding{holdingsCount === 1 ? '' : 's'})</span>
        </h2>
        <div className="text-sm text-gray-400">
          Total Value: ${totalValue.toFixed(2)}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Portfolio Chart */}
        <div className="h-64">
          {portfolioData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={portfolioData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {portfolioData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <Wallet className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No portfolio data available</p>
              </div>
            </div>
          )}
        </div>

        {/* Portfolio Details */}
        <div className="space-y-4">
          {portfolioData.length > 0 ? (
            portfolioData.map((item, index) => (
              <div key={item.name} className="bg-gray-900 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    ></div>
                    <span className="text-white font-medium">{item.icon} {item.displayName}</span>
                  </div>
                  <span className="text-gray-400 text-sm">
                    {((item.value / totalValue) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="text-gray-300 text-sm">
                  <p>Amount: {item.name === 'USD' || item.name === 'USDC' ? 
                    item.amount.toFixed(2) : 
                    item.amount.toFixed(6)} {item.name}</p>
                  <p>Value: ${item.value.toFixed(2)}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-gray-900 rounded-lg p-4 text-center text-gray-400">
              <p>No holdings to display</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Portfolio
