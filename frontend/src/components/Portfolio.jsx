import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react'

const Portfolio = ({ portfolio, allPrices }) => {
  // Cryptocurrency metadata with unique colors and proper icons
  const cryptoInfo = {
    USD: { icon: '💵', color: '#10B981', name: 'US Dollar' },
    USDC: { icon: '💰', color: '#2775CA', name: 'USD Coin' },
    BTC: { icon: '₿', color: '#F7931A', name: 'Bitcoin' },
    ETH: { icon: '⟠', color: '#627EEA', name: 'Ethereum' },
    ETH2: { icon: '⟠', color: '#627EEA', name: 'Ethereum 2.0' },
    ADA: { icon: '₳', color: '#0033AD', name: 'Cardano' },
    SOL: { icon: '◎', color: '#9945FF', name: 'Solana' },
    DOT: { icon: '⬤', color: '#E6007A', name: 'Polkadot' },
    MATIC: { icon: '⬟', color: '#8247E5', name: 'Polygon' },
    POLY: { icon: '⬟', color: '#8247E5', name: 'Polygon' }, // POLY maps to same as MATIC
    AVAX: { icon: '🔺', color: '#E84142', name: 'Avalanche' },
    LINK: { icon: '🔗', color: '#375BD2', name: 'Chainlink' },
    UNI: { icon: '🦄', color: '#FF007A', name: 'Uniswap' },
    ATOM: { icon: '⚛️', color: '#2E3148', name: 'Cosmos' },
    XRP: { icon: '💧', color: '#23292F', name: 'Ripple' },
    XLM: { icon: '*', color: '#3F51B5', name: 'Stellar' },
    LTC: { icon: 'Ł', color: '#A6A9AA', name: 'Litecoin' },
    BCH: { icon: '₿', color: '#8DC351', name: 'Bitcoin Cash' },
    DOGE: { icon: 'Ð', color: '#C2A633', name: 'Dogecoin' },
    BSV: { icon: '₿', color: '#EAB300', name: 'Bitcoin SV' },
    BAT: { icon: 'B', color: '#FF5000', name: 'Basic Attention Token' },
    ENJ: { icon: 'E', color: '#624DBF', name: 'Enjin Coin' },
    ZRX: { icon: 'Z', color: '#302C2C', name: '0x' },
    ETC: { icon: 'Ξ', color: '#328332', name: 'Ethereum Classic' },
    VET: { icon: '⚡', color: '#15BDFF', name: 'VeChain' },
    ALGO: { icon: '△', color: '#000000', name: 'Algorand' },
    TRON: { icon: '◉', color: '#FF060A', name: 'TRON' },
    FTM: { icon: '👻', color: '#1969FF', name: 'Fantom' },
    NEAR: { icon: '🌐', color: '#00C08B', name: 'NEAR Protocol' },
    PBVAONFR: { icon: '🔒', color: '#FF6B35', name: 'Coinbase Vault' } // Coinbase-specific vault currency
  }

  // Calculate portfolio data
  const portfolioData = []
  let totalValue = 0
  let holdingsCount = 0

  Object.entries(portfolio || {}).forEach(([currency, amount]) => {
    // Only filter out truly negligible amounts to avoid showing dust
    const minAmount = (currency === 'USD' || currency === 'USDC') ? 0.001 : 0.0000001;
    
    if (amount > minAmount) {
      const info = cryptoInfo[currency] || { icon: '❓', color: '#6B7280', name: currency };
      
      // Handle special mappings where portfolio currency differs from price feed symbol
      let priceSymbol = currency;
      if (currency === 'POLY') {
        priceSymbol = 'MATIC'; // POLY uses MATIC-USD price feed
      } else if (currency === 'ETH2') {
        priceSymbol = 'ETH'; // ETH2 uses ETH-USD price feed
      }

      let value;
      let price = 1; // Default price for USD/USDC
      
      if (currency === 'USD' || currency === 'USDC') {
        // USD and stablecoins have 1:1 value
        value = amount;
        price = 1;
      } else {
        // For crypto, get price from allPrices
        const productId = `${priceSymbol}-USD`;
        price = allPrices?.[productId] || 0; // Default to 0 if price not found
        value = amount * price;
      }
      
      // Include all holdings that pass the minimal amount filter
      holdingsCount++;
      totalValue += value;
      portfolioData.push({
        currency,
        amount,
        value,
        icon: info.icon,
        color: info.color,
        displayName: info.name || currency,
        name: currency,
        price: price
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
          <p className="text-gray-300">{`Value: $${data.value < 0.01 ? data.value.toFixed(4) : data.value.toFixed(2)}`}</p>
          <p className="text-gray-300">
            {`Amount: ${data.currency === 'USD' || data.currency === 'USDC' ? 
              data.amount.toFixed(2) : 
              data.amount < 0.001 ? data.amount.toExponential(2) : data.amount.toFixed(6)} ${data.currency}`}
          </p>
          {data.currency !== 'USD' && data.currency !== 'USDC' && (
            <p className="text-gray-400 text-sm">{`Price: $${data.price.toFixed(2)}`}</p>
          )}
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
        <div className="text-right">
          <div className="text-sm text-gray-400">Total Value</div>
          <div className="text-2xl font-bold text-green-400">${totalValue.toFixed(2)}</div>
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
              <div key={item.currency} className="bg-gray-900 rounded-lg p-4">
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
                <div className="text-gray-300 text-sm space-y-1">
                  <p>Amount: {item.currency === 'USD' || item.currency === 'USDC' ? 
                    item.amount.toFixed(2) : 
                    item.amount < 0.001 ? item.amount.toExponential(2) : item.amount.toFixed(6)} {item.currency}</p>
                  <p>Value: <span className="font-medium text-green-400">${item.value < 0.01 ? item.value.toFixed(4) : item.value.toFixed(2)}</span></p>
                  {item.currency !== 'USD' && item.currency !== 'USDC' && (
                    <p>Price: <span className="text-blue-400">${item.price.toFixed(2)}</span></p>
                  )}
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
