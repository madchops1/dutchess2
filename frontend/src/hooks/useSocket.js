import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'

const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'

export const useSocket = (url = backendUrl) => {
  const [socket, setSocket] = useState(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const newSocket = io(url)
    setSocket(newSocket)

    newSocket.on('connect', () => {
      setConnected(true)
    })

    newSocket.on('disconnect', () => {
      setConnected(false)
    })

    return () => {
      newSocket.close()
    }
  }, [url])

  return { socket, connected }
}

export const useApi = () => {
  const fetchData = async (endpoint) => {
    try {
      const response = await fetch(endpoint)
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      return await response.json()
    } catch (error) {
      console.error('API error:', error)
      throw error
    }
  }

  const postData = async (endpoint, data) => {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      return await response.json()
    } catch (error) {
      console.error('API error:', error)
      throw error
    }
  }

  return { fetchData, postData }
}
