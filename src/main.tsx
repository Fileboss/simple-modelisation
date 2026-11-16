import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import { HomePage } from './app/HomePage';
import { JoinPage } from './app/JoinPage';
import { ProjectPage } from './app/ProjectPage';
import { RegistryProvider } from './app/RegistryProvider';
import './index.css';

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<RegistryProvider>
			<BrowserRouter>
				<Routes>
					<Route path="/" element={<HomePage />} />
					<Route path="/p/:projectId" element={<ProjectPage />} />
					<Route path="/s/:projectId" element={<JoinPage />} />
				</Routes>
			</BrowserRouter>
		</RegistryProvider>
	</StrictMode>
);
