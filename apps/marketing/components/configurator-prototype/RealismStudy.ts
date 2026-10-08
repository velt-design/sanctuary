import { createContext, useContext } from 'react';

/** Local-only scene treatment; does not alter customer design or pricing. */
export const RealismStudy = createContext(false);
export const useRealismStudy = () => useContext(RealismStudy);
