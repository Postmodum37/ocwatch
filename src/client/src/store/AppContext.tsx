import type { ReactNode } from 'react';
import { UIStateProvider } from './UIStateContext';
import { PollDataProvider } from './PollDataContext';

interface AppProviderProps {
  children: ReactNode;
  apiUrl?: string;
  pollingInterval?: number;
}

export function AppProvider({ children, apiUrl, pollingInterval }: AppProviderProps) {
  return (
    <UIStateProvider apiUrl={apiUrl}>
      <PollDataProvider apiUrl={apiUrl} pollingInterval={pollingInterval}>
        {children}
      </PollDataProvider>
    </UIStateProvider>
  );
}
