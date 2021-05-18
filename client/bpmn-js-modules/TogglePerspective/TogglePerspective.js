import { domify, event as domEvent } from 'min-dom';
import { UPDATE_RESOURCES } from '../util/EventHelper';

import { intersection } from 'lodash';

const ALL_POOLS = '0_all_pools';

export default function TogglePerspective(eventBus, canvas, elementRegistry, layerManager) {
  let self = this;

  this._eventBus = eventBus;
  this._canvas = canvas;
  this._elementRegistry = elementRegistry;
  this._layerManager = layerManager;
  this.oldElementsMarked = [];
  this.perspectiveType = 'global';
  this.resourceValue = ALL_POOLS;
  this.isResourceLane = false;
  this.parentLaneId = undefined;

  this._eventBus.on('import.done', () => self._init());
  this._eventBus.on(UPDATE_RESOURCES, () => {
    updateResources.call(self);
  });
}

function getResourceOptions(layerManager) {
  let options = [`<option value="${ALL_POOLS}" data-isLane="false" selected>All</option>`];
  let resources = layerManager.getResources();
  resources.forEach(resource => {

    options.push(`<option value="${resource.id}" data-isLane="false">${resource.name}</option>`);
    if (resource.lanes.length > 0) {
      resource.lanes.forEach(lane => {
        options.push(`<option value="${lane}" data-parent="${resource.id}" data-isLane="true">->&nbsp;${lane}</option>`);
      });
    }
  });
  return options;
}

function updateResources() {
  this.resource.innerHTML = '';
  let options = getResourceOptions(this._layerManager);
  options.forEach(option => {
    this.resource.appendChild(domify(option));
  });
}

TogglePerspective.prototype._init = function() {

  this.globalContainer = domify('<div class="perspective-palette"></div>');

  this.perspectiveContainer = domify(`
    <div class="toggle-perspective">
        <label for="perspective">Perspective:&nbsp;</label>
    </div>
  `);
  let perspective = domify(`<select name="perspective">
    <option value="global" selected>Global</option>
    <option value="control">Control-flow</option>
    <option value="data">Data</option>
  </select>`);

  domEvent.bind(perspective, 'change', (event) => {

    self.perspectiveType = event.target.value;
    updateView.call(self, event.target.value, self.resourceValue, self.isResourceLane, self.parentLaneId);
  });

  this.organizationalContainer = domify(`
  <div class="toggle-resource">
    <label for="resource">Resource: </label>
  </div>`);
  this.resource = domify('<select name="resource"></select>');
  updateResources.call(this);

  let self = this;
  domEvent.bind(this.resource, 'change', (event) => {
    let isLane = event.target.options[event.target.options.selectedIndex].getAttribute('data-isLane');
    let parent = event.target.options[event.target.options.selectedIndex].getAttribute('data-parent');

    self.resourceValue = event.target.value;
    self.isResourceLane = (isLane === 'true');
    self.parentLaneId = parent;

    updateView.call(self, self.perspectiveType, event.target.value, (isLane === 'true'), parent);
  });

  this.organizationalContainer.appendChild(this.resource);
  this.perspectiveContainer.appendChild(perspective);
  this.globalContainer.appendChild(this.perspectiveContainer);
  this.globalContainer.appendChild(this.organizationalContainer);
  this._canvas.getContainer().appendChild(this.globalContainer);
};

function fitCanvasToElement(selectedId) {
  let bbox = this._elementRegistry.get(selectedId);
  let currentViewBox = this._canvas.viewbox();

  let elementMid = {
    x: bbox.x + bbox.width / 2,
    y: bbox.y + bbox.height / 2
  };
  this._canvas.viewbox({
    x: elementMid.x - currentViewBox.width / 2,
    y: elementMid.y - currentViewBox.height / 2,
    width: currentViewBox.width,
    height: currentViewBox.height
  });
}

function updateView(perspectiveType, selectedElementId, isLane, parentId) {
  this.oldElementsMarked.forEach(elementId => {
    this._canvas.removeMarker(elementId, 'disabled-element');
  });
  this.oldElementsMarked = [];

  let resources = this._layerManager.getResources(true);
  let elements = this._layerManager.getElements(perspectiveType) || [];

  resources.forEach(resource => {

    // for each pool => disable
    if (resource.id !== selectedElementId) {
      if (!isLane || resource.id !== parentId) {

        // Selected a pool or it's a lane of another pool
        this.oldElementsMarked.push(...resource.elements, resource.id);
        if (!isLane) {
          resource.lanes.forEach(lane => {
            let [laneId, elementsArray] = Object.entries(lane)[0];
            this.oldElementsMarked.push(...elementsArray, laneId);
          });
        }
      } else {
        resource.lanes.forEach(lane => {
          let [laneId, elementsArray] = Object.entries(lane)[0];
          if (laneId !== selectedElementId) {
            this.oldElementsMarked.push(...elementsArray, laneId);
          } else {
            fitCanvasToElement.call(this, selectedElementId);
          }
        });
      }
    } else {
      fitCanvasToElement.call(this, selectedElementId);
    }
  });

  if (perspectiveType !== 'global' || selectedElementId !== ALL_POOLS) {
    let newArray;
    if (perspectiveType !== 'global' && selectedElementId !== ALL_POOLS) {
      newArray = this.oldElementsMarked.concat(elements);
    } else if (resources.length > 0) {
      newArray = intersection(this.oldElementsMarked, elements);
    } else {
      newArray = elements;
    }
    newArray.forEach(elementId => {
      this._canvas.addMarker(elementId, 'disabled-element');
    });
    this.oldElementsMarked = newArray;
  }
  if (selectedElementId === ALL_POOLS) {
    this._canvas.zoom('fit-viewport', 'auto');
  }
}

TogglePerspective.$inject = ['eventBus', 'canvas', 'elementRegistry', 'layerManager'];