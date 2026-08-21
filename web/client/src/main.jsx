import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import dayjs from 'dayjs'
import updateLocale from 'dayjs/plugin/updateLocale'
import App from './App.jsx'
import './index.css'

dayjs.extend(updateLocale)
dayjs.updateLocale('en', { weekStart: 0 })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
