import { getBusinessObject, is } from 'bpmn-js/lib/util/ModelUtil';

import { CollaborationElements, DataElements } from './LayerElements';

import { flatMap, filter, find, remove } from 'lodash';

import {
  add as collectionAdd
} from 'diagram-js/lib/util/Collections';

export default function LayerManager(eventBus) {
  this.layers = {
    control: [], // element ids
    data: [], // element ids
    pools: []

    /* hierarchy structure : {
        id: poolId,
        process: processId,
        elements: [] element ids,
        lanes: [] lane ids => element ids
    } */
  };

  let self = this;

  function getProcess(element) {
    let businessObject = getBusinessObject(element);

    if (is(businessObject, 'bpmn:Participant')) {
      return businessObject.processRef;
    }
    if (is(businessObject, 'bpmn:Process')) {
      return businessObject;
    }
    if (is(businessObject, 'bpmn:MessageFlow')) {
      return undefined;
    }

    let parent = businessObject;
    while (parent.$parent && !is(parent, 'bpmn:Process')) {
      parent = parent.$parent;
    }

    if (!is(parent, 'bpmn:Process')) {
      return undefined;
    }
    return parent;
  }

  function addLayerElement(element) {
    let isDataElement = DataElements.some(elementType => {
      return is(element, elementType);
    });
    let isCollaborationElement = CollaborationElements.some(elementType => {
      return is(element, elementType);
    });
    let isParticipant = is(element, 'bpmn:Participant');

    if (isDataElement) {
      collectionAdd(self.layers.data, element.id);
    } else if (isCollaborationElement) {
      if (isParticipant) {
        let bo = getBusinessObject(element);
        collectionAdd(self.layers.pools, {
          id: element.id,
          process: bo.get('processRef') ? bo.get('processRef').id : undefined,
          elements: [],
          lanes: []
        });
      }

      // if is a lane, do nothing here
    } else {
      collectionAdd(self.layers.control, element.id);
    }

    let isCollaboration = self.layers.pools.length > 0;
    if (isCollaboration && !isParticipant) {
      let rootElement = getProcess(element);
      if (rootElement) {
        let pool = find(self.layers.pools, { process: rootElement.id });
        if (pool) {
          if (is(element, 'bpmn:Lane')) {
            let lane = {};
            let bo = getBusinessObject(element);
            lane[element.id] = bo.flowNodeRef && bo.flowNodeRef.map(flowNode => flowNode.id) || [];
            collectionAdd(pool.lanes, lane);
          } else {
            collectionAdd(pool.elements, element.id);
          }
        }
      }
    }
  }

  function updateLayerPools(element, additions, removals) {
    removals.forEach(oldLane => {
      let lane = find(
        flatMap(self.layers.pools, 'lanes'),
        poolLane => {
          let [laneId] = Object.entries(poolLane)[0];
          return oldLane.id === laneId;
        });
      if (lane) {
        let [laneId, elementsArray] = Object.entries(lane)[0];
        lane[laneId] = filter(elementsArray, id => id !== element.id);
      }
    });
    additions.forEach(newLane => {
      let lane = find(
        flatMap(self.layers.pools, 'lanes'),
        poolLane => {
          let [laneId] = Object.entries(poolLane)[0];
          return newLane.id === laneId;
        });
      if (lane) {
        let [laneId] = Object.entries(lane)[0];
        collectionAdd(lane[laneId], element.id);
      }

    });
  }

  function removeLayerElement(element) {
    remove(self.layers.data, id => id === element.id);
    remove(self.layers.control, id => id === element.id);

    let isCollaboration = self.layers.pools.length > 0;
    if (isCollaboration) {
      if (is(element, 'bpmn:Participant')) {

        // Remove only the pool, the inner elements where already removed before
        remove(self.layers.pools, pool => pool.id === element.id);
      } else if (is(element, 'bpmn:Lane')) {

        // Remove only the lane, which is only logical
        let process = getProcess(element);
        let pool = find(self.layers.pools, { process: process.id });
        remove(pool.lanes, lane => {
          let [laneId] = Object.entries(lane)[0];
          return laneId === element.id;
        });
      } else {
        let rootElement = getProcess(element);
        if (rootElement) {

          // Remove a single element from the pool hierarchy and, if present, from lanes
          let pool = find(self.layers.pools, { process: rootElement.id });
          remove(pool.elements, id => id === element.id);
          if (pool.lanes.length > 0) {
            let occurredLane = find(pool.lanes, lane => {
              let [, elementsArray] = Object.entries(lane)[0];
              return elementsArray.indexOf(element.id) !== -1;
            });

            if (occurredLane) {
              let [laneId, elementsArray] = Object.entries(occurredLane)[0];
              occurredLane[laneId] = filter(elementsArray, id => id !== element.id);
            }
          }
        }
      }
    }
  }

  eventBus.on(['shape.added', 'connection.added', 'commandStack.shape.create.postExecuted'], context => {
    console.log('AddLayer ' + stringify(self.layers, 5, null, 2));
    let element = context.element || context.context.shape;
    addLayerElement(element);
  });
  eventBus.on(['shape.removed', 'connection.removed'], context => {
    console.log('removeLayer ' + stringify(self.layers, 5, null, 2));
    let element = context.element;
    removeLayerElement(element);
  });

  eventBus.on('commandStack.lane.updateRefs.postExecute', context => {
    console.log('LANE.UPDATEREFS ' + stringify(context, 5, null, 2));
    let ctx = context.context.updates;
    ctx.forEach(update => {
      let element = update.flowNode;
      if (update.add.length > 0 || update.remove.length > 0) {
        updateLayerPools(element, update.add, update.remove);
      }
    });
    console.log('LANE.UPDATEREFS ' + stringify(self.layers, 5, null, 2));
  });

}

const stringify = function(val, depth, replacer, space) {
  depth = isNaN(+depth) ? 1 : depth;

  function _build(key, val, depth, o, a) { // (JSON.stringify() has it's own rules, which we respect here by using it for property iteration)
    return !val || typeof val != 'object' ? val : (a = Array.isArray(val), JSON.stringify(val, function(k, v) {
      if (a || depth > 0) {
        if (replacer) v = replacer(k, v);
        if (!k) return (a = Array.isArray(v), val = v);
        !o && (o = a ? [] : {});
        o[k] = _build(k, v, a ? depth : depth - 1);
      }
    }), o || (a ? [] : {}));
  }

  return JSON.stringify(_build('', val, depth), null, space);
};

LayerManager.$inject = ['eventBus'];

LayerManager.prototype.getElements = function(type) {
  let typeToHide;
  switch (type) {
  case 'control':
    typeToHide = 'data';
    break;
  case 'data' :
    typeToHide = 'control';
    break;
  default:
    typeToHide = 'global';
  }

  return this.layers[typeToHide];
};