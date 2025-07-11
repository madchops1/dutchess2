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
  const [smaConfig, setSmaConfig] = useState({
    period: 20,
    targetGainPercent: 2.0, // 2% target gain
    riskRewardRatio: 2.0, // 1:2 risk:reward ratio
    tradeAmount: 0.01 // Default trade amount
  });

  // Sync local trading mode with parent's trading mode
  useEffect(() => {
    setTradingMode(parentTradingMode)
  }, [parentTradingMode])

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
      description: 'Buy on SMA crossover with risk management via target/stop-loss',
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
    
    // Update any running strategies with the new mode
    strategies.forEach(strategy => {
      if (strategy.active) {
        let strategyParams = { mode };
        
        // For SMA strategy, include current smaConfig
        if (strategy.name === 'sma') {
          strategyParams = {
            ...smaConfig,
            mode
          };
        }
        
        // Update the running strategy with new mode
        onStrategyAction('update', strategy.name, strategyParams);
      }
    });
  }

  const handleStartStrategy = () => {
    let strategyParams = parameters[selectedStrategy];
    
    // For SMA strategy, merge in the smaConfig parameters
    if (selectedStrategy === 'sma') {
      strategyParams = {
        ...parameters[selectedStrategy],
        ...smaConfig,
        mode: tradingMode // Use current trading mode
      };
    } else {
      strategyParams = {
        ...parameters[selectedStrategy],
        mode: tradingMode // Use current trading mode
      };
    }
    
    onStrategyAction('start', selectedStrategy, strategyParams)
  }

  const handleUpdateStrategy = () => {
    let strategyParams = {};
    
    // For SMA strategy, use the smaConfig parameters
    if (selectedStrategy === 'sma') {
      strategyParams = {
        ...smaConfig
      };
    } else {
      strategyParams = parameters[selectedStrategy];
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
            <div className="grid grid-cols-2 gap-4">
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
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Trade Amount
                </label>
                <input
                  type="number"
                  min="0.001"
                  max="10"
                  step="0.001"
                  value={smaConfig.tradeAmount}
                  onChange={(e) => setSmaConfig(prev => ({...prev, tradeAmount: parseFloat(e.target.value)}))}
                  className="input w-full bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Amount of crypto to trade</p>
              </div>
              
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Target Gain (%)
                </label>
                <input
                  type="number"
                  min="0.5"
                  max="10"
                  step="0.1"
                  value={smaConfig.targetGainPercent}
                  onChange={(e) => setSmaConfig(prev => ({...prev, targetGainPercent: parseFloat(e.target.value)}))}
                  className="input w-full bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Target profit percentage before taking profit</p>
              </div>
              
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Risk:Reward Ratio
                </label>
                <select
                  value={smaConfig.riskRewardRatio}
                  onChange={(e) => setSmaConfig(prev => ({...prev, riskRewardRatio: parseFloat(e.target.value)}))}
                  className="input w-full bg-gray-700 border-gray-600 text-white focus:border-blue-500"
                >
                  <option value={1}>1:1 (Risk 2% to gain 2%)</option>
                  <option value={1.5}>1:1.5 (Risk 1.33% to gain 2%)</option>
                  <option value={2}>1:2 (Risk 1% to gain 2%)</option>
                  <option value={3}>1:3 (Risk 0.67% to gain 2%)</option>
                  <option value={4}>1:4 (Risk 0.5% to gain 2%)</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">How much you're willing to risk vs. potential gain</p>
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

      {/* Trading Mode Controls */}
      <div className="mt-6">
        <h4 className="text-sm font-medium text-gray-300 mb-3">Trading Mode</h4>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleTradingModeChange('stopped')}
            disabled={tradingMode === 'stopped'}
            className={`btn ${
              tradingMode === 'stopped' 
                ? 'bg-gray-600 text-white cursor-not-allowed opacity-75' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <Pause className="h-4 w-4 mr-2" />
            {tradingMode === 'stopped' ? 'Stopped' : 'Stop'}
          </button>
          <button
            onClick={() => handleTradingModeChange('simulation')}
            disabled={tradingMode === 'simulation'}
            className={`btn ${
              tradingMode === 'simulation' 
                ? 'bg-blue-600 text-white cursor-not-allowed opacity-75' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <Play className="h-4 w-4 mr-2" />
            {tradingMode === 'simulation' ? 'Simulating' : 'Simulate'}
          </button>
          <button
            onClick={() => handleTradingModeChange('active')}
            disabled={tradingMode === 'active'}
            className={`btn ${
              tradingMode === 'active' 
                ? 'bg-green-600 text-white cursor-not-allowed opacity-75' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <DollarSign className="h-4 w-4 mr-2" />
            {tradingMode === 'active' ? 'Trading' : 'Trade'}
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
