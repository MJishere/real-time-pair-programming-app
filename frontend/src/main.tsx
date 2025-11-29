// App entry: mounts React and provides the Redux store
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { Provider } from "react-redux";
import { store } from "./store/store";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* Make Redux store available to the entire app */}
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>
);
