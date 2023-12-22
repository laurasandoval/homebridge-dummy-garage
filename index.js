var Service, Characteristic, HomebridgeAPI;

module.exports = function (homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	HomebridgeAPI = homebridge;
	homebridge.registerAccessory('homebridge-dummy-garage', 'DummyGarage', DummyGarage);
}

class DummyGarage {
	constructor(log, config) {

		//get config values
		this.name = config['name'] || "Dummy Garage";
		this.openingStateDuration = config["openingStateDuration"] === undefined ? 0 : Number(config["openingStateDuration"]);
		this.openStateDuration = config["openStateDuration"] === undefined ? 0 : Number(config["openStateDuration"]);
		this.closingStateDuration = config["closingStateDuration"] === undefined ? 0 : Number(config["closingStateDuration"]);

		//persist storage
		this.cacheDirectory = HomebridgeAPI.user.persistPath();
		this.storage = require('node-persist');
		this.storage.initSync({ dir: this.cacheDirectory, forgiveParseErrors: true });
		this.cachedState = this.storage.getItemSync(this.name);

		//initial setup
		this.log = log;
		this.lastOpened = new Date();
		this.service = new Service.GarageDoorOpener(this.name, this.name);
		this.setupGarageDoorOpenerService(this.service);

		this.informationService = new Service.AccessoryInformation();
		this.informationService
			.setCharacteristic(Characteristic.Manufacturer, 'github/rasod')
			.setCharacteristic(Characteristic.Model, 'Dummy Garage')
			.setCharacteristic(Characteristic.FirmwareRevision, '1.2.2')
			.setCharacteristic(Characteristic.SerialNumber, this.name.replace(/\s/g, '').toUpperCase());
	}

	getServices() {
		return [this.informationService, this.service];
	}

	setupGarageDoorOpenerService(service) {
		this.log.debug("setupGarageDoorOpenerService");
		this.log.debug("Cached State: " + this.cachedState);

		if ((this.cachedState === undefined) || (this.cachedState === true)) {
			this.log.debug("Using Saved OPEN State");
			this.service.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.OPEN);
		} else {
			this.log.debug("Using Default CLOSED State");
			this.service.setCharacteristic(Characteristic.TargetDoorState, Characteristic.TargetDoorState.CLOSED);
			this.service.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSED);
		}

		service.getCharacteristic(Characteristic.TargetDoorState)
			.on('get', (callback) => {
				var targetDoorState = service.getCharacteristic(Characteristic.TargetDoorState).value;
				callback(null, targetDoorState);
			})
			.on('set', (value, callback) => {
				if (value === Characteristic.TargetDoorState.OPEN) {
					// Setting door state to OPEN
					this.lastOpened = new Date();

					this.log(`Opening ${this.name}. Will stay "opening" for ${this.openStateDuration} seconds.`)
					this.service.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSED);
					this.service.setCharacteristic(Characteristic.TargetDoorState, Characteristic.TargetDoorState.OPEN);

					setTimeout(() => {
						this.log(`${this.name} set to OPEN. Will stay open for ${this.openStateDuration} seconds.`)
						this.service.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.OPEN);
						this.storage.setItem(this.name, true);

						setTimeout(() => {
							this.service.setCharacteristic(Characteristic.TargetDoorState, Characteristic.TargetDoorState.CLOSED);
						}, this.openStateDuration * 1000);
					}, this.openingStateDuration * 1000);

					callback();

				} else if (value === Characteristic.TargetDoorState.CLOSED) {
					this.log(`Closing ${this.name}. Will stay "closing" for ${this.closingStateDuration} seconds.`)
					this.service.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.OPEN);
					this.service.setCharacteristic(Characteristic.TargetDoorState, Characteristic.TargetDoorState.CLOSED);

					setTimeout(() => {
						this.log(`${this.name} set to CLOSED..`)
						this.service.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSED);
						this.storage.setItem(this.name, false);
						callback();
					}, this.closingStateDuration * 1000);
				} else {
					callback();
				}
			});
	}
}