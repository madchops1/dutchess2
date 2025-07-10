import { useState, useEffect } from 'react'
import { Settings, Play, Square, TrendingUp, BarChart3, Zap, Pause, DollarSign } from 'lucide-react'

const StrategyControls = ({ strategies, onStrategyAction, onSmaPeriodChange, onTradingModeChange, tradingMode: parentTradingMode = 'stopped' }) => {
  const [selectedStrategy, setSelectedStrategy] = useState('sma')
  const [tradingMode, setTradingMode] = useState(parentTradingMode) // Use parent's trading mode
  const [parameters, setParameters] = useState({
    sma: { period: 20, tradeAmount: 0.01 },
    rsi: { period: 14, oversold: 30, overbought: 70, tradeAmount: 0.01 },
    macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, tradeAmount: 0.01 }
  })

  // Sync local trading mode with parent's trading mode
  useEffect(() => {
    setTradingMode(parentTradingMode)
  }, [parentTradingMode])

  const strategyConfig = {
    sma: {
      name: 'Simple Moving Average',
      description: 'Buy when price crosses above SMA, sell when below',
      icon: TrendingUp,
      color: 'text-blue-500'
    },
    rsi: {
      name: 'RSI Strategy',
      description: 'Buy when oversold, sell when overbought',
      icon: BarChart3,
      color: 'text-green-500'
    },
    macd: {
      name: 'MACD Strategy',
      description: 'Buy on bullish crossover, sell on bearish crossover',
      icon: Zap,
      color: 'text-purple-500'
    }
  }

  const handleTradingModeChange = (mode) => {
    setTradingMode(mode)
    if (onTradingModeChange) {
      onTradingModeChange(mode)
    }
    
    // Start or stop the strategy based on mode
    if (mode === 'stopped') {
      onStrategyAction('stop', selectedStrategy)
    } else {
      // For both simulation and active, we start the strategy
      // The backend can differentiate between simulation and real trading
      onStrategyAction('start', selectedStrategy, {
        ...parameters[selectedStrategy],
        mode: mode // 'simulation' or 'active'
      })
    }
  }

  const handleParameterChange = (strategy, param, value) => {
    setParameters(prev => {
      const updated = {
        ...prev,
        [strategy]: {
          ...prev[strategy],
          [param]: parseFloat(value) || value
        }
      }
      // If SMA period changes, notify parent
      if (strategy === 'sma' && param === 'period' && onSmaPeriodChange) {
        onSmaPeriodChange(updated.sma.period)
      }
      return updated
    })
  }

  const isStrategyRunning = (strategyName) => {
    return strategies.some(s => s.name === strategyName && s.active)
  }

  const renderParameters = () => {
    const strategy = selectedStrategy
    const config = strategyConfig[strategy]
    const params = parameters[strategy]

    return (
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-300">Parameters</h4>
        
        {strategy === 'sma' && (
          <>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Period</label>
              <input
                type="number"
                value={params.period}
                onChange={(e) => handleParameterChange(strategy, 'period', e.target.value)}
                className="input w-full"
                min="1"
                max="200"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Trade Amount (BTC)</label>
              <input
                type="number"
                value={params.tradeAmount}
                onChange={(e) => handleParameterChange(strategy, 'tradeAmount', e.target.value)}
                className="input w-full"
                min="0.001"
                step="0.001"
              />
            </div>
          </>
        )}

        {strategy === 'rsi' && (
          <>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Period</label>
              <input
                type="number"
                value={params.period}
                onChange={(e) => handleParameterChange(strategy, 'period', e.target.value)}
                className="input w-full"
                min="1"
                max="50"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Oversold Level</label>
              <input
                type="number"
                value={params.oversold}
                onChange={(e) => handleParameterChange(strategy, 'oversold', e.target.value)}
                className="input w-full"
                min="10"
                max="40"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Overbought Level</label>
              <input
                type="number"
                value={params.overbought}
                onChange={(e) => handleParameterChange(strategy, 'overbought', e.target.value)}
                className="input w-full"
                min="60"
                max="90"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Trade Amount (BTC)</label>
              <input
                type="number"
                value={params.tradeAmount}
                onChange={(e) => handleParameterChange(strategy, 'tradeAmount', e.target.value)}
                className="input w-full"
                min="0.001"
                step="0.001"
              />
            </div>
          </>
        )}

        {strategy === 'macd' && (
          <>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Fast Period</label>
              <input
                type="number"
                value={params.fastPeriod}
                onChange={(e) => handleParameterChange(strategy, 'fastPeriod', e.target.value)}
                className="input w-full"
                min="1"
                max="30"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Slow Period</label>
              <input
                type="number"
                value={params.slowPeriod}
                onChange={(e) => handleParameterChange(strategy, 'slowPeriod', e.target.value)}
                className="input w-full"
                min="10"
                max="50"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Signal Period</label>
              <input
                type="number"
                value={params.signalPeriod}
                onChange={(e) => handleParameterChange(strategy, 'signalPeriod', e.target.value)}
                className="input w-full"
                min="1"
                max="20"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Trade Amount (BTC)</label>
              <input
                type="number"
                value={params.tradeAmount}
                onChange={(e) => handleParameterChange(strategy, 'tradeAmount', e.target.value)}
                className="input w-full"
                min="0.001"
                step="0.001"
              />
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white flex items-center">
          <Settings className="h-5 w-5 mr-2 text-blue-500" />
          Strategy Controls
        </h2>
      </div>

      {/* Strategy Selection */}
      <div className="space-y-4 mb-6">
        <h3 className="text-lg font-medium text-white">Select Strategy</h3>
        <div className="space-y-2">
          {Object.entries(strategyConfig).map(([key, config]) => {
            const Icon = config.icon
            const running = isStrategyRunning(key)
            return (
              <div
                key={key}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedStrategy === key
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
                onClick={() => setSelectedStrategy(key)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Icon className={`h-5 w-5 ${config.color}`} />
                    <div>
                      <h4 className="font-medium text-white">{config.name}</h4>
                      <p className="text-sm text-gray-400">{config.description}</p>
                    </div>
                  </div>
                  {running && (
                    <div className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                      Running
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Parameters */}
      {renderParameters()}

      {/* Trading Mode Controls */}
      <div className="mt-6">
        <h4 className="text-sm font-medium text-gray-300 mb-3">Trading Mode</h4>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleTradingModeChange('stopped')}
            className={`btn ${
              tradingMode === 'stopped' 
                ? 'bg-gray-600 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <Pause className="h-4 w-4 mr-2" />
            Stop
          </button>
          <button
            onClick={() => handleTradingModeChange('simulation')}
            className={`btn ${
              tradingMode === 'simulation' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <Play className="h-4 w-4 mr-2" />
            Simulate
          </button>
          <button
            onClick={() => handleTradingModeChange('active')}
            className={`btn ${
              tradingMode === 'active' 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <DollarSign className="h-4 w-4 mr-2" />
            Trade
          </button>
        </div>
        <div className="mt-2 text-sm text-gray-400">
          {tradingMode === 'stopped' && 'Trading is stopped. No signals will be shown.'}
          {tradingMode === 'simulation' && 'Simulation mode. Signals shown but no real trades.'}
          {tradingMode === 'active' && 'Active trading. Real trades will be executed.'}
        </div>
      </div>
    </div>
  )
}

export default StrategyControls
