import { registerRootComponent } from 'expo';

import Raiz from './src/Raiz';

// registerRootComponent calls AppRegistry.registerComponent('main', () => Raiz);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(Raiz);
