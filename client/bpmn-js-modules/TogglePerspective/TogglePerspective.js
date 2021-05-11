import { domify, event as domEvent } from 'min-dom';
import { UPDATE_RESOURCES } from '../util/EventHelper';

export default function TogglePerspective(eventBus, canvas, elementRegistry, layerManager) {
  let self = this;

  this._eventBus = eventBus;
  this._canvas = canvas;
  this._elementRegistry = elementRegistry;
  this._layerManager = layerManager;
  this.oldElementsMarked = [];

  this._eventBus.on('import.done', () => self._init());

  this._eventBus.on(UPDATE_RESOURCES, () => {
    updateResources.call(self);
  });
}

function getResourceOptions(layerManager, selectedValue) {
  let options = [];
  let resources = layerManager.getResources();
  resources.forEach(resource => {

    // TODO: selectedValue
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

  domEvent.bind(perspective, 'change', this.changePerspective.bind(this));

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
    self.changeResource.call(self, event.target.value, isLane, parent);
  });

  this.organizationalContainer.appendChild(this.resource);
  this.perspectiveContainer.appendChild(perspective);
  this.globalContainer.appendChild(this.perspectiveContainer);
  this.globalContainer.appendChild(this.organizationalContainer);
  this._canvas.getContainer().appendChild(this.globalContainer);
};

TogglePerspective.prototype.changePerspective = function(event) {
  let elements = this._layerManager.getElements(event.target.value) || [];
  this.oldElementsMarked.forEach(elementId => {
    this._canvas.removeMarker(elementId, 'disabled-element');
  });
  elements.forEach(elementId => {
    this._canvas.addMarker(elementId, 'disabled-element');
  });
  this.oldElementsMarked = elements;

  // TODO: Disable modeling on elements
};

TogglePerspective.prototype.changeResource = function(selectedElementId, isLane, parentId) {

  let resources = this._layerManager.getResources(true);
  this.oldElementsMarked.forEach(elementId => {
    this._canvas.removeMarker(elementId, 'disabled-element');
  });
  this.oldElementsMarked = [];

  let self = this;

  function fitCanvasToElement(selectedElementId) {
    let bbox = self._elementRegistry.get(selectedElementId);
    let currentViewBox = self._canvas.viewbox();

    let elementMid = {
      x: bbox.x + bbox.width / 2,
      y: bbox.y + bbox.height / 2
    };
    self._canvas.viewbox({
      x: elementMid.x - currentViewBox.width / 2,
      y: elementMid.y - currentViewBox.height / 2,
      width: currentViewBox.width,
      height: currentViewBox.height
    });
  }

  resources.forEach(resource => {

    // for each pool => disable
    if (resource.id !== selectedElementId) {
      if (!isLane || resource.id !== parentId) {

        // Selected a pool
        this.oldElementsMarked.push(...resource.elements, resource.id);
      } else {
        resource.lanes.forEach(lane => {
          let [laneId, elementsArray] = Object.entries(lane)[0];
          if (laneId !== selectedElementId) {
            this.oldElementsMarked.push(...elementsArray, laneId);
          } else {
            fitCanvasToElement(selectedElementId);
          }
        });
      }
    } else {
      fitCanvasToElement(selectedElementId);
    }
  });

  this.oldElementsMarked.forEach(elementId => {
    self._canvas.addMarker(elementId, 'disabled-element');
  });

  // TODO: Disable modeling on elements
};

TogglePerspective.$inject = ['eventBus', 'canvas', 'elementRegistry', 'layerManager'];