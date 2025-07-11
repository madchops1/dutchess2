import { useState, useEffect } from 'react'
import { DollarSign, TrendingUp, Shield, Play, Pause, CheckSquare, Square } from 'lucide-react'

const TradeControls = ({ 
  strategies, 
  tradingMode, 
  onTradingModeChange,
  tradeConfig,
  onTradeConfigChange,
  enabledStrategies,
  onEnabledStrategiesChange
}) => {
  // Default trade configuration
  const defaultTradeConfig = {
    tradeAmount: 0.01
  }

  const [localTradeConfig, setLocalTradeConfig] = useState({
    ...defaultTradeConfig,
    ...tradeConfig
  })

  const [localEnabledStrategies, setLocalEnabledStrategies] = useState(
    enabledStrategies || new Set(['sma'])
  )

  // Sync local state with props
  useEffect(() => {
    setLocalTradeConfig({
      ...defaultTradeConfig,
      ...tradeConfig
    })
  }, [tradeConfig])

  useEffect(() => {
    setLocalEnabledStrategies(enabledStrategies || new Set(['sma']))
  }, [enabledStrategies])

  const handleTradeConfigChange = (field, value) => {
    const newConfig = {
      ...localTradeConfig,
      [field]: parseFloat(value) || value
    }
    setLocalTradeConfig(newConfig)
    if (onTradeConfigChange) {
      onTradeConfigChange(newConfig)
    }
  }

  const handleStrategyToggle = (strategyName) => {
    const newEnabled = new Set(localEnabledStrategies)
    if (newEnabled.has(strategyName)) {
      newEnabled.delete(strategyName)
    } else {
      newEnabled.add(strategyName)
    }
    setLocalEnabledStrategies(newEnabled)
    if (onEnabledStrategiesChange) {
      onEnabledStrategiesChange(newEnabled)
    }
  }

  const isStrategyRunning = (strategyName) => {
    return strategies.some(s => s.name === strategyName && s.active)
  }

  const strategyConfig = {
    sma: {
      name: 'Simple Moving Average',
      shortName: 'SMA',
      color: 'text-blue-500'
    },
    rsi: {
      name: 'RSI Strategy',
      shortName: 'RSI',
      color: 'text-green-500'
    },
    macd: {
      name: 'MACD Strategy',
      shortName: 'MACD',
      color: 'text-purple-500'
    }
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white flex items-center">
          <DollarSign className="h-5 w-5 mr-2 text-green-500" />
          Trade Controls
        </h2>
      </div>

      {/* Risk Management Configuration */}
      <div className="space-y-4 mb-6">
        <h3 className="text-lg font-medium text-white flex items-center">
          <Shield className="h-4 w-4 mr-2 text-yellow-500" />
          Risk Management
        </h3>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Trade Amount
            </label>
            <input
              type="number"
              min="0.001"
              max="10"
              step="0.001"
              value={localTradeConfig.tradeAmount}
              onChange={(e) => handleTradeConfigChange('tradeAmount', e.target.value)}
              className="input w-full bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">Amount of crypto to trade per signal</p>
          </div>
        </div>
      </div>

      {/* Strategy Selection for Trading */}
      <div className="space-y-4 mb-6">
        <h3 className="text-lg font-medium text-white flex items-center">
          <TrendingUp className="h-4 w-4 mr-2 text-blue-500" />
          Active Trading Strategies
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          Select which strategies should generate trade signals. Trades execute when enabled strategies have simultaneous crossovers.
        </p>
        
        <div className="space-y-3">
          {Object.entries(strategyConfig).map(([key, config]) => {
            const isRunning = isStrategyRunning(key)
            const isEnabled = localEnabledStrategies.has(key)
            const isDisabled = !isRunning
            
            return (
              <div
                key={key}
                className={`p-3 rounded-lg border transition-colors ${
                  isEnabled && !isDisabled
                    ? 'border-green-500 bg-green-500/10'
                    : isDisabled
                    ? 'border-gray-600 bg-gray-800/50'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => !isDisabled && handleStrategyToggle(key)}
                      disabled={isDisabled}
                      className={`p-1 rounded transition-colors ${
                        isDisabled
                          ? 'text-gray-500 cursor-not-allowed'
                          : isEnabled
                          ? 'text-green-500 hover:text-green-400'
                          : 'text-gray-400 hover:text-gray-300'
                      }`}
                    >
                      {isEnabled ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                    </button>
                    <div>
                      <h4 className={`font-medium ${isDisabled ? 'text-gray-500' : 'text-white'}`}>
                        {config.shortName}
                      </h4>
                      <p className={`text-sm ${isDisabled ? 'text-gray-600' : 'text-gray-400'}`}>
                        {config.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {isRunning ? (
                      <div className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                        Running
                      </div>
                    ) : (
                      <div className="px-2 py-1 bg-gray-500/20 text-gray-500 rounded text-xs">
                        Stopped
                      </div>
                    )}
                    {isEnabled && isRunning && (
                      <div className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                        Trading
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        
        <div className="text-sm text-gray-400">
          {localEnabledStrategies.size === 0 && 'No strategies enabled for trading.'}
          {localEnabledStrategies.size === 1 && 'Trades will execute when the enabled strategy generates signals.'}
          {localEnabledStrategies.size > 1 && 'Trades will execute when ALL enabled strategies have simultaneous crossovers.'}
        </div>
      </div>

      {/* Trading Mode Controls */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-white">Trading Mode</h3>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onTradingModeChange('stopped')}
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
            onClick={() => onTradingModeChange('simulation')}
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
            onClick={() => onTradingModeChange('active')}
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
        <div className="text-sm text-gray-400">
          {tradingMode === 'stopped' && 'Trading is stopped. No signals will be shown.'}
          {tradingMode === 'simulation' && 'Simulation mode. Signals shown but no real trades.'}
          {tradingMode === 'active' && 'Active trading. Real trades will be executed.'}
        </div>
      </div>
    </div>
  )
}

export default TradeControls
