import { AppProvider } from './context/AppContext';
import { MainLayout } from './components/layout/MainLayout';

function App() {
  return (
    <div className="app-ready">
      <AppProvider>
        <MainLayout />
      </AppProvider>
    </div>
  );
}

export default App;