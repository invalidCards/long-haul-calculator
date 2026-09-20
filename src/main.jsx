import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles/global.css'
import './styles/long-haul.css'

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
