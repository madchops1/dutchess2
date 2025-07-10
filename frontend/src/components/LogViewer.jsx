import { useState } from 'react'
import { FileText, Activity, AlertCircle, Info, AlertTriangle } from 'lucide-react'

const LogViewer = ({ logs, trades }) => {
  const [activeTab, setActiveTab] = useState('logs')

  const getLogIcon = (level) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'warn':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />
      default:
        return <Activity className="h-4 w-4 text-gray-500" />
    }
  }

  const getLogColor = (level) => {
    switch (level) {
      case 'error':
        return 'text-red-400'
      case 'warn':
        return 'text-yellow-400'
      case 'info':
        return 'text-blue-400'
      default:
        return 'text-gray-400'
    }
  }

  const getTradeStatusColor = (status) => {
    switch (status) {
      case 'success':
        return 'text-green-400'
      case 'error':
        return 'text-red-400'
      default:
        return 'text-gray-400'
    }
  }

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    })
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white flex items-center">
          <FileText className="h-5 w-5 mr-2 text-blue-500" />
          Activity Monitor
        </h2>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-4">
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'logs'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          System Logs
        </button>
        <button
          onClick={() => setActiveTab('trades')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'trades'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Trading Activity
        </button>
      </div>

      {/* Log Content */}
      <div className="bg-gray-900 rounded-lg p-4 h-96 overflow-y-auto">
        {activeTab === 'logs' && (
          <div className="space-y-2">
            {logs.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No logs yet...</p>
              </div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="flex items-start space-x-3 py-2 px-3 rounded hover:bg-gray-800 transition-colors">
                  <div className="flex-shrink-0 mt-0.5">
                    {getLogIcon(log.level)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">{formatTime(log.timestamp)}</span>
                      <span className={`text-xs px-2 py-1 rounded ${getLogColor(log.level)} bg-gray-800`}>
                        {log.service}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 mt-1">{log.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'trades' && (
          <div className="space-y-2">
            {trades.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No trading activity yet...</p>
              </div>
            ) : (
              trades.map((trade, index) => (
                <div key={trade.id || index} className="flex items-start space-x-3 py-2 px-3 rounded hover:bg-gray-800 transition-colors">
                  <div className="flex-shrink-0 mt-0.5">
                    <Activity className={`h-4 w-4 ${getTradeStatusColor(trade.status)}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">{formatTime(trade.timestamp)}</span>
                      <span className={`text-xs px-2 py-1 rounded ${getTradeStatusColor(trade.status)} bg-gray-800`}>
                        {trade.strategy}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 mt-1">
                      <span className="font-medium">{trade.action}</span> - {trade.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default LogViewer
