import { domify, event as domEvent } from 'min-dom';

export default function TogglePerspective(eventBus, canvas, layerManager) {
  var self = this;

  this._eventBus = eventBus;
  this._canvas = canvas;
  this._layerManager = layerManager;
  this.oldElementsMarked = [];

  this._eventBus.on('import.done', () => self._init());

  getResourceOptions.bind(this);
}

function getResourceOptions(layerManager, selectedValue) {
  let options = [];
  let resources = layerManager.getResources();
  resources.forEach(resource => {

    // TODO: selectedValue
    options.push(`<option value="${resource.id}">${resource.name}</option>`);
    if (resource.lanes.length > 0) {
      resource.lanes.forEach(lane => {
        options.push(`<option value="${lane}">->&nbsp;${lane}</option>`);
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

  domEvent.bind(this.resource, 'change', this.changeResource.bind(this));

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

TogglePerspective.prototype.changeResource = function(event) {};

TogglePerspective.$inject = ['eventBus', 'canvas', 'layerManager'];