'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type PaywallVisibilityContextValue = {
  paywallVisible: boolean;
  setPaywallVisible: (visible: boolean) => void;
};

const PaywallVisibilityContext = createContext<PaywallVisibilityContextValue | null>(null);

export function PaywallVisibilityProvider({ children }: { children: ReactNode }) {
  const [paywallVisible, setPaywallVisible] = useState(false);
  const setter = useCallback((visible: boolean) => {
    setPaywallVisible(visible);
  }, []);
  return (
    <PaywallVisibilityContext.Provider value={{ paywallVisible, setPaywallVisible: setter }}>
      {children}
    </PaywallVisibilityContext.Provider>
  );
}

export function usePaywallVisibility(): PaywallVisibilityContextValue {
  const ctx = useContext(PaywallVisibilityContext);
  if (!ctx) {
    return {
      paywallVisible: false,
      setPaywallVisible: () => {},
    };
  }
  return ctx;
}
