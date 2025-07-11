import { useState, useEffect } from 'react'
import { Settings, Play, Square, TrendingUp, BarChart3, Zap } from 'lucide-react'

const StrategyControls = ({ strategies, onStrategyAction, onSmaPeriodChange, tradeConfig, tradingMode }) => {
  const [selectedStrategy, setSelectedStrategy] = useState('sma')
  const [parameters, setParameters] = useState({
    sma: { period: 20 },
    rsi: { period: 14, oversold: 30, overbought: 70, minMovementPercent: 0.5 },
    macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, minMovementPercent: 0.5 }
  })
  const [smaConfig, setSmaConfig] = useState({
    period: 20,
    minMovementPercent: 0.5 // 0.5% minimum price movement
  });

  // Sync smaConfig period with parameters
  useEffect(() => {
    setSmaConfig(prev => ({
      ...prev,
      period: parameters.sma.period
    }))
  }, [parameters.sma.period])

  const strategyConfig = {
    sma: {
      name: 'Simple Moving Average',
      description: 'Buy on SMA crossover with minimum movement filter and automatic risk management',
      icon: TrendingUp,
      color: 'text-blue-500'
    },
    rsi: {
      name: 'RSI Strategy',
      description: 'Buy when oversold, sell when overbought with movement filtering',
      icon: BarChart3,
      color: 'text-green-500'
    },
    macd: {
      name: 'MACD Strategy',
      description: 'Buy on bullish crossover, sell on bearish crossover with movement filtering',
      icon: Zap,
      color: 'text-purple-500'
    }
  }

  const handleStartStrategy = () => {
    let strategyParams = parameters[selectedStrategy];
    
    // For SMA strategy, merge in the smaConfig parameters and tradeConfig
    if (selectedStrategy === 'sma') {
      strategyParams = {
        ...parameters[selectedStrategy],
        ...smaConfig,
        ...tradeConfig, // Include trade configuration from parent
        mode: tradingMode, // Use current trading mode from parent
        // Convert percentage from whole number to decimal (0.5% -> 0.005)
        minMovementPercent: smaConfig.minMovementPercent / 100
      };
    } else {
      strategyParams = {
        ...parameters[selectedStrategy],
        ...tradeConfig, // Include trade configuration from parent
        mode: tradingMode, // Use current trading mode from parent
        // Convert percentage from whole number to decimal for other strategies
        minMovementPercent: parameters[selectedStrategy].minMovementPercent / 100
      };
    }
    
    onStrategyAction('start', selectedStrategy, strategyParams)
  }

  const handleUpdateStrategy = () => {
    let strategyParams = {};
    
    // For SMA strategy, use the smaConfig parameters and tradeConfig
    if (selectedStrategy === 'sma') {
      strategyParams = {
        ...smaConfig,
        ...tradeConfig, // Include trade configuration from parent
        // Convert percentage from whole number to decimal (0.5% -> 0.005)
        minMovementPercent: smaConfig.minMovementPercent / 100
      };
    } else {
      strategyParams = {
        ...parameters[selectedStrategy],
        ...tradeConfig, // Include trade configuration from parent
        // Convert percentage from whole number to decimal for other strategies
        minMovementPercent: parameters[selectedStrategy].minMovementPercent / 100
      };
    }
    
    onStrategyAction('update', selectedStrategy, strategyParams)
  }

  const handleStopStrategy = () => {
    onStrategyAction('stop', selectedStrategy)
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
      // If SMA period changes, notify parent and sync with smaConfig
      if (strategy === 'sma' && param === 'period' && onSmaPeriodChange) {
        onSmaPeriodChange(updated.sma.period)
        setSmaConfig(prevConfig => ({
          ...prevConfig,
          period: updated.sma.period
        }))
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
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  SMA Period
                </label>
                <input
                  type="number"
                  min="5"
                  max="200"
                  value={smaConfig.period}
                  onChange={(e) => setSmaConfig(prev => ({...prev, period: parseInt(e.target.value)}))}
                  className="input w-full bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Number of periods for moving average calculation</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Min Movement (%)
                </label>
                <input
                  type="number"
                  min="0.1"
                  max="5.0"
                  step="0.1"
                  value={smaConfig.minMovementPercent}
                  onChange={(e) => setSmaConfig(prev => ({...prev, minMovementPercent: parseFloat(e.target.value)}))}
                  className="input w-full bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Minimum price movement required to generate crossover signals</p>
              </div>
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
              <label className="block text-sm text-gray-400 mb-1">Min Movement (%)</label>
              <input
                type="number"
                value={params.minMovementPercent}
                onChange={(e) => handleParameterChange(strategy, 'minMovementPercent', e.target.value)}
                className="input w-full"
                min="0.1"
                max="5.0"
                step="0.1"
              />
              <p className="text-xs text-gray-400 mt-1">Minimum price movement required for signals</p>
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
              <label className="block text-sm text-gray-400 mb-1">Min Movement (%)</label>
              <input
                type="number"
                value={params.minMovementPercent}
                onChange={(e) => handleParameterChange(strategy, 'minMovementPercent', e.target.value)}
                className="input w-full"
                min="0.1"
                max="5.0"
                step="0.1"
              />
              <p className="text-xs text-gray-400 mt-1">Minimum price movement required for signals</p>
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

      {/* Strategy Control Buttons */}
      <div className="mt-6">
        <h4 className="text-sm font-medium text-gray-300 mb-3">Strategy Control</h4>
        <div className="flex gap-3">
          <button
            onClick={handleStartStrategy}
            disabled={isStrategyRunning(selectedStrategy)}
            className={`btn flex-1 ${
              isStrategyRunning(selectedStrategy)
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            <Play className="h-4 w-4 mr-2" />
            {isStrategyRunning(selectedStrategy) ? 'Running' : 'Start Strategy'}
          </button>
          <button
            onClick={handleUpdateStrategy}
            disabled={!isStrategyRunning(selectedStrategy)}
            className={`btn flex-1 ${
              !isStrategyRunning(selectedStrategy)
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-yellow-600 text-white hover:bg-yellow-700'
            }`}
          >
            <Settings className="h-4 w-4 mr-2" />
            Update
          </button>
          <button
            onClick={handleStopStrategy}
            disabled={!isStrategyRunning(selectedStrategy)}
            className={`btn flex-1 ${
              !isStrategyRunning(selectedStrategy)
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            <Square className="h-4 w-4 mr-2" />
            Stop Strategy
          </button>
        </div>
        <div className="mt-2 text-sm text-gray-400">
          {isStrategyRunning(selectedStrategy) 
            ? `${selectedStrategy.toUpperCase()} strategy is running in ${tradingMode} mode`
            : `Start the ${selectedStrategy.toUpperCase()} strategy to begin generating signals`
          }
        </div>
      </div>
    </div>
  )
}

export default StrategyControls
