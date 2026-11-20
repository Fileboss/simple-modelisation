import { Component, type ReactNode } from 'react';
import { strings } from './strings';

type Props = { children: ReactNode };
type State = { failed: boolean };

/**
 * Shows a message with Reload instead of a blank page should drawing a Project
 * throw (an entry no read anticipated).
 */
export class ErrorBoundary extends Component<Props, State> {
	state: State = { failed: false };

	static getDerivedStateFromError(): State {
		return { failed: true };
	}

	componentDidCatch(error: unknown) {
		console.error('Project could not be shown', error);
	}

	render() {
		if (!this.state.failed) return this.props.children;
		return (
			<main className="status" role="alert">
				<p>{strings.project.cannotShow}</p>
				<button onClick={() => location.reload()}>{strings.project.reload}</button>
			</main>
		);
	}
}
