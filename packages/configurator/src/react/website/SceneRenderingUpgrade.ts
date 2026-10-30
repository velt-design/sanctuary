import { createContext, useContext } from 'react';
export const SceneRenderingUpgrade = createContext(false);
export const useSceneRenderingUpgrade = () => useContext(SceneRenderingUpgrade);
