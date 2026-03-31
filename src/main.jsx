import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
<<<<<<< HEAD
import { BrowserRouter } from 'react-router-dom'
import { Provider } from "react-redux";
import rootReducer from "./reducers/index";
import {configureStore} from "@reduxjs/toolkit"
import { Toaster } from "react-hot-toast";


const store = configureStore({
  reducer:rootReducer,
});

createRoot(document.getElementById('root')).render(
    <Provider store = {store}>
      <BrowserRouter>
        <App />
        <Toaster/>
      </BrowserRouter>
  </Provider>
=======

createRoot(document.getElementById('root')).render(
    <App/>
>>>>>>> bcd4d640dce6d010d57ee7ccdaaeab5cbbcfc60f
)
