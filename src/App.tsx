import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { QuestionnaireForm } from './components/QuestionnaireForm';
import { Impressum } from './pages/Impressum';
import './App.css';

const TeamEntry = lazy(() => import('./pages/TeamEntry').then((module) => ({ default: module.TeamEntry })));

function App() {
  return (
    <Router>
      <Suspense fallback={<div className="form-container"><div className="error-message">Загрузка...</div></div>}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/questionnaire/:id" element={<QuestionnaireForm />} />
          <Route path="/team" element={<TeamEntry />} />
          <Route path="/impressum" element={<Impressum />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;

