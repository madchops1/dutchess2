import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Users, Clock } from 'lucide-react'

const PerformanceTracker = ({ selectedStrategy = 'sma' }) => {
  const [performance, setPerformance] = useState(null)
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchPerformance = async () => {
    try {
      setLoading(true)
      const response = await fetch(`http://localhost:3000/strategy/performance/${selectedStrategy}`)
      const data = await response.json()
      
      if (data.success) {
        setPerformance(data.performance)
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchTrades = async () => {
    try {
      const response = await fetch(`http://localhost:3000/strategy/trades/${selectedStrategy}`)
      const data = await response.json()
      
      if (data.success) {
        setTrades(data.trades.slice(-10)) // Last 10 trades
      }
    } catch (err) {
      console.error('Failed to fetch trades:', err)
    }
  }

  useEffect(() => {
    fetchPerformance()
    fetchTrades()
    
    // Refresh every 5 seconds
    const interval = setInterval(() => {
      fetchPerformance()
      fetchTrades()
    }, 5000)
    
    return () => clearInterval(interval)
  }, [selectedStrategy])

  if (loading) return <div className="card p-6">Loading performance data...</div>

  if (error) return (
    <div className="card p-6">
      <div className="text-gray-400">No performance data available</div>
      <div className="text-sm text-gray-500 mt-1">Strategy must be running to track performance</div>
    </div>
  )

  if (!performance) return null

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(value)
  }

  const formatCrypto = (value) => {
    return parseFloat(value).toFixed(8)
  }

  return (
    <div className="space-y-4">
      {/* Performance Summary */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-green-500" />
            Performance Summary
          </h2>
          <div className="text-sm text-gray-400">{selectedStrategy.toUpperCase()} Strategy</div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center">
              <DollarSign className={`h-5 w-5 mr-2 ${performance.netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`} />
              <div>
                <div className="text-sm text-gray-400">Net P&L</div>
                <div className={`text-lg font-semibold ${performance.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(performance.netProfit)}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center">
              <Users className="h-5 w-5 mr-2 text-blue-500" />
              <div>
                <div className="text-sm text-gray-400">Win Rate</div>
                <div className="text-lg font-semibold text-white">
                  {performance.winRate}%
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center">
              <Clock className="h-5 w-5 mr-2 text-purple-500" />
              <div>
                <div className="text-sm text-gray-400">Total Trades</div>
                <div className="text-lg font-semibold text-white">
                  {performance.totalTrades}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center">
              <DollarSign className="h-5 w-5 mr-2 text-yellow-500" />
              <div>
                <div className="text-sm text-gray-400">Total Fees</div>
                <div className="text-lg font-semibold text-white">
                  {formatCurrency(performance.totalFees)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="text-sm text-gray-400 mb-1">Gross Profit</div>
            <div className="text-lg font-semibold text-green-400">
              {formatCurrency(performance.grossProfit)}
            </div>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="text-sm text-gray-400 mb-1">Gross Loss</div>
            <div className="text-lg font-semibold text-red-400">
              {formatCurrency(performance.grossLoss)}
            </div>
          </div>
        </div>
      </div>

      {/* Virtual Portfolio */}
      {Object.keys(performance.portfolio).length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Virtual Portfolio</h3>
          <div className="space-y-2">
            {Object.entries(performance.portfolio).map(([symbol, holding]) => (
              <div key={symbol} className="flex justify-between items-center bg-gray-800 p-3 rounded">
                <div>
                  <div className="font-medium text-white">{symbol}</div>
                  <div className="text-sm text-gray-400">{formatCrypto(holding.amount)} coins</div>
                </div>
                <div className="text-right">
                  <div className="text-white">Avg: {formatCurrency(holding.avgPrice)}</div>
                  <div className="text-sm text-gray-400">Cost: {formatCurrency(holding.totalCost)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Trades */}
      {trades.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Trades</h3>
          <div className="space-y-2">
            {trades.map((trade) => (
              <div key={trade.id} className="flex justify-between items-center bg-gray-800 p-3 rounded">
                <div className="flex items-center">
                  {trade.type === 'BUY' ? (
                    <TrendingUp className="h-4 w-4 mr-2 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 mr-2 text-red-500" />
                  )}
                  <div>
                    <div className="font-medium text-white">
                      {trade.type} {trade.cryptoSymbol}
                    </div>
                    <div className="text-sm text-gray-400">
                      {new Date(trade.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white">
                    {formatCrypto(trade.amount)} @ {formatCurrency(trade.price)}
                  </div>
                  {trade.profit !== undefined && (
                    <div className={`text-sm ${trade.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      P&L: {formatCurrency(trade.profit)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default PerformanceTracker
