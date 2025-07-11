import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Users, Clock, AlertCircle } from 'lucide-react'

const PerformanceTracker = ({ selectedStrategy = 'sma', tradingMode = 'stopped' }) => {
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

  const formatDateTime = (timestamp) => {
    return new Date(timestamp).toLocaleString()
  }

  const isSimulationMode = tradingMode === 'simulation'

  return (
    <div className="space-y-4">
      {/* Performance Summary */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-green-500" />
            Performance Summary
            {isSimulationMode && (
              <span className="ml-2 px-2 py-1 bg-blue-600 text-xs rounded-full text-white">
                SIMULATION
              </span>
            )}
          </h2>
          <div className="text-sm text-gray-400">{selectedStrategy.toUpperCase()} Strategy</div>
        </div>

        {/* Session Info */}
        <div className="mb-4 text-sm text-gray-400">
          Session started: {formatDateTime(performance.sessionStartTime)}
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
            <div className="text-sm text-gray-400 mb-1">Realized P&L</div>
            <div className={`text-lg font-semibold ${performance.realizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(performance.realizedPnL)}
            </div>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="text-sm text-gray-400 mb-1">Unrealized P&L</div>
            <div className={`text-lg font-semibold ${performance.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(performance.unrealizedPnL)}
            </div>
          </div>
        </div>
      </div>

      {/* Trading Activity */}
      {performance.totalTrades > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Trading Activity</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800 p-3 rounded-lg text-center">
              <div className="text-sm text-gray-400">Buy Orders</div>
              <div className="text-xl font-semibold text-green-400">{performance.buyTrades}</div>
            </div>
            <div className="bg-gray-800 p-3 rounded-lg text-center">
              <div className="text-sm text-gray-400">Sell Orders</div>
              <div className="text-xl font-semibold text-red-400">{performance.sellTrades}</div>
            </div>
            <div className="bg-gray-800 p-3 rounded-lg text-center">
              <div className="text-sm text-gray-400">Winners</div>
              <div className="text-xl font-semibold text-green-400">{performance.winningTrades}</div>
            </div>
            <div className="bg-gray-800 p-3 rounded-lg text-center">
              <div className="text-sm text-gray-400">Losers</div>
              <div className="text-xl font-semibold text-red-400">{performance.losingTrades}</div>
            </div>
          </div>
        </div>
      )}

      {/* Virtual Portfolio (only for simulation mode) */}
      {isSimulationMode && Object.keys(performance.portfolio || {}).length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <AlertCircle className="h-5 w-5 mr-2 text-blue-500" />
            Simulated Positions
          </h3>
          <div className="space-y-2">
            {Object.entries(performance.portfolio).map(([productId, position]) => (
              <div key={productId} className="flex justify-between items-center bg-gray-800 p-3 rounded">
                <div>
                  <div className="font-medium text-white">{productId}</div>
                  <div className="text-sm text-gray-400">{formatCrypto(position.amount)} coins</div>
                </div>
                <div className="text-right">
                  <div className="text-white">Avg: {formatCurrency(position.avgPrice)}</div>
                  <div className="text-sm text-gray-400">Cost: {formatCurrency(position.totalCost)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Trades */}
      {performance.recentTrades && performance.recentTrades.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Trades</h3>
          <div className="space-y-2">
            {performance.recentTrades.map((trade) => (
              <div key={trade.id} className="flex justify-between items-center bg-gray-800 p-3 rounded">
                <div className="flex items-center">
                  {trade.side === 'BUY' ? (
                    <TrendingUp className="h-4 w-4 mr-2 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 mr-2 text-red-500" />
                  )}
                  <div>
                    <div className="font-medium text-white flex items-center">
                      {trade.side} {trade.cryptoSymbol}
                      {trade.isSimulated && (
                        <span className="ml-2 px-1 py-0.5 bg-blue-600 text-xs rounded text-white">SIM</span>
                      )}
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
                  {trade.realizedPnL !== undefined && trade.side === 'SELL' && (
                    <div className={`text-sm ${trade.realizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      P&L: {formatCurrency(trade.realizedPnL)}
                    </div>
                  )}
                  {trade.fees > 0 && (
                    <div className="text-xs text-gray-500">
                      Fee: {formatCurrency(trade.fees)}
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
