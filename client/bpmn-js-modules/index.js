import LayerManager from './LayerManager/LayerManager';
import TogglePerspective from './TogglePerspective/TogglePerspective';

export default {
  __init__: ['layerManager', 'togglePerspective'],
  layerManager : [ 'type', LayerManager],
  togglePerspective : ['type', TogglePerspective]
};