"use strict";

/*
 * Created with @iobroker/create-adapter v3.1.2
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
// Require dgram module.
const dgram = require("node:dgram");

// Load your modules here, e.g.:
// const fs = require("node:fs");

const cBrunnerEAS3HeizraumTemperatur = "CombustionTemperature";
const cBrunnerEAS3AbbrandStatus = "BurningStatus";
const cBrunnerEAS3Broadcast = "Broadcast";
const cBrunnerEAS3LetzterAbbrand = "LastBurning";
const cBrunnerEAS3LetzterAbbrandMS = "LastBurningMS";
const cBrunnerEAS3Drosselklappe = "ThrottleValve";
const cBrunnerEAS3HolzNachlegen = "AddMoreWood";
const cBrunnerEAS3Summer = "Buzzer";
const cBrunnerEAS3FirmwareVersion = "FirmwareVersion";
const cBrunnerEAS3ConnectionState = "info.connection";

class BrunnerEas3 extends utils.Adapter {
	/**
	 * @param {Partial<utils.AdapterOptions>} [options] - Adapter options
	 */
	constructor(options) {
		super({
			...options,
			name: "brunner-eas3",
		});
		this.on("ready", this.onReady.bind(this));
		this.on("stateChange", this.onStateChange.bind(this));
		// this.on("objectChange", this.onObjectChange.bind(this));
		// this.on("message", this.onMessage.bind(this));
		this.on("unload", this.onUnload.bind(this));
		this.server = null; // Socket-Variable definieren
		this.timerConnectionId = null; // Variable für den Timer
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		// Initialize your adapter here

		// Reset the connection indicator during startup
		this.setState("info.connection", false, true);

		// The adapters config (in the instance object everything under the attribute "native") is accessible via
		// this.config:
		// this.log.debug(`"config option2: ${this.config.EASPortNumber}`);
		this.log.debug(`config option AddUDPStringAsObject: ${this.config.AddUDPString}`);

		/*
		For every state in the system there has to be also an object of type state
		Here a simple template for a boolean variable named "testVariable"
		Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables

		IMPORTANT: State roles should be chosen carefully based on the state's purpose.
		           Please refer to the state roles documentation for guidance:
		           https://www.iobroker.net/#en/documentation/dev/stateroles.md
		*/

		// Status Brunner:
		// -1 - Status nicht verfügbar. WLAN unterbrochen
		// 0 - Türe offen
		// 1 - Abrand start
		// 2-  Abbrand Stufe 2...
		// 5 - Abbrand Ende
		// 6 - Fehler/Timeout, Abbrandt Start wurde nicht erkannt
		// 7 - Alles vorbei... Aus.

		await this.setObjectNotExistsAsync(cBrunnerEAS3HeizraumTemperatur, {
			type: "state",
			common: {
				name: {
					en: "Brunner fireplace combustion chamber temperature",
					de: "Brunner Kamineinsatz Verbrennungskammertemperatur",
					ru: "Температура горения в топке камина Brunner",
					pt: "Temperatura da câmara de combustão da lareira Brunner",
					nl: "Temperatuur van de verbrandingskamer van de Brunner open haard",
					fr: "Température de la chambre de combustion de la cheminée Brunner",
					it: "Temperatura della camera di combustione del camino Brunner.",
					es: "Temperatura de la cámara de combustión de la chimenea Brunner",
					pl: "Temperatura komory spalania kominka Brunner",
					uk: "Температура горіння вогнища каміну Brunner",
					"zh-cn": "布伦纳壁炉燃烧室温度",
				},
				type: "number",
				role: "value.temperature",
				read: true,
				write: false,
				unit: "°C",
			},
			native: {},
		});

		await this.setObjectNotExistsAsync(cBrunnerEAS3AbbrandStatus, {
			type: "state",
			common: {
				name: {
					en: "Brunner fireplace burning status",
					de: "Status der Brunner Abbrand Status",
					ru: "Состояние горения камина Brunner",
					pt: "Estado de combustão da lareira Brunner",
					nl: "Brunner openhaard brandstatus",
					fr: "Statut de combustion de la cheminée Brunner",
					it: "Stato di combustione del camino Brunner",
					es: "Estado de combustión de la chimenea Brunner",
					pl: "Stan spalania w kominku Brunner",
					uk: "Стан горіння каміна Brunner",
					"zh-cn": "布鲁纳壁炉燃烧状态",
				},
				type: "number",
				role: "info.status",
				read: true,
				write: false,
				unit: "",
			},
			native: {},
		});

		if (this.config.AddUDPString == true) {
			await this.setObjectNotExistsAsync(cBrunnerEAS3Broadcast, {
				type: "state",
				common: {
					name: {
						en: "Brunner fireplace broadcast message",
						de: "Brunner Kamin broadcast",
						ru: "Сообщение для камина Бруннера",
						pt: "Mensagem de difusão da lareira Brunner",
						nl: "Brunner open haard omroepbericht",
						fr: "Message de diffusion de la cheminée Brunner",
						it: "Messaggio di trasmissione del caminetto Brunner",
						es: "Mensaje de difusión de la chimenea Brunner",
						pl: "Komunikat nadawany przez kominek Brunner",
						uk: "Повідомлення про трансляцію каміна Brunner",
						"zh-cn": "布鲁纳壁炉广播消息",
					},
					type: "string",
					role: "text",
					read: true,
					write: false,
					unit: "",
				},
				native: {},
			});
		} else {
			try {
				await this.delObjectAsync(cBrunnerEAS3Broadcast);
			} catch {
				this.log.debug(`Object ${cBrunnerEAS3Broadcast} already deleted`);
			}
		}

		await this.setObjectNotExistsAsync(cBrunnerEAS3LetzterAbbrand, {
			type: "state",
			common: {
				name: {
					en: "Brunner fireplace last burn",
					de: "Brunner Kamin letzter Abbrand",
					ru: "Последний камин Brunner",
					pt: "Última combustão da lareira Brunner",
					nl: "Brunner open haard laatste verbranding",
					fr: "Dernier feu de la cheminée Brunner",
					it: "Caminetto Brunner ultima combustione",
					es: "Última quema de la chimenea Brunner",
					pl: "Ostatni płomień kominka Brunner",
					uk: "Останній розпал каміна Brunner",
					"zh-cn": "布鲁纳壁炉最后一次燃烧",
				},
				type: "string",
				role: "date",
				read: true,
				write: false,
				unit: "",
			},
			native: {},
		});

		await this.setObjectNotExistsAsync(cBrunnerEAS3LetzterAbbrandMS, {
			type: "state",
			common: {
				name: {
					en: "Brunner fireplace last burn in milliseconds",
					de: "Brunner Kamin letzte Verbrennung in Millisekunden",
					ru: "Время последнего горения камина Brunner в миллисекундах",
					pt: "Última combustão da lareira Brunner em milissegundos",
					nl: "Brunner-openhaard laatste verbranding in milliseconden",
					fr: "Dernière combustion de la cheminée Brunner en millisecondes",
					it: "Caminetto Brunner ultima combustione in millisecondi",
					es: "Última combustión de la chimenea Brunner en milisegundos",
					pl: "Ostatnie spalanie kominka Brunner w milisekundach",
					uk: "Камін Brunner догорає за мілісекунди",
					"zh-cn": "布鲁纳壁炉最后一次燃烧的毫秒数",
				},
				type: "number",
				role: "value.timer",
				read: true,
				write: false,
				unit: "ms",
			},
			native: {},
		});

		await this.setObjectNotExistsAsync(cBrunnerEAS3Drosselklappe, {
			type: "state",
			common: {
				name: {
					en: "throttle valve",
					de: "Drosselklappe",
					ru: "дроссельная заслонка",
					pt: "válvula de aceleração",
					nl: "gasklep",
					fr: "soupape d'accélérateur",
					it: "valvola a farfalla",
					es: "válvula de mariposa",
					pl: "zawór przepustnicy",
					uk: "дросельний клапан",
					"zh-cn": "节气门",
				},
				type: "number",
				role: "value.valve",
				read: true,
				write: false,
				unit: "",
			},
			native: {},
		});

		await this.setObjectNotExistsAsync(cBrunnerEAS3HolzNachlegen, {
			type: "state",
			common: {
				name: {
					en: "Add more wood",
					de: "Holz nachlegen",
					ru: "Добавьте еще дров",
					pt: "Adicione mais madeira",
					nl: "Voeg meer hout toe",
					fr: "Ajoutez plus de bois",
					it: "Aggiungi più legna",
					es: "Añade más madera",
					pl: "Dodaj więcej drewna",
					uk: "Додайте більше деревини",
					"zh-cn": "添加更多木材",
				},
				type: "number",
				role: "value",
				read: true,
				write: false,
				unit: "",
			},
			native: {},
		});

		await this.setObjectNotExistsAsync(cBrunnerEAS3Summer, {
			type: "state",
			common: {
				name: {
					en: "Buzzer",
					de: "Summer",
					ru: "Зуммер",
					pt: "Buzina",
					nl: "Zoemer",
					fr: "Ronfleur",
					it: "Cicalino",
					es: "Zumbador",
					pl: "Brzęczyk",
					uk: "Зумер",
					"zh-cn": "蜂鸣器",
				},
				type: "boolean",
				role: "sensor.alarm",
				read: true,
				write: false,
				unit: "",
			},
			native: {},
		});

		await this.setObjectNotExistsAsync(cBrunnerEAS3FirmwareVersion, {
			type: "state",
			common: {
				name: {
					en: "Firmware Version",
					de: "Firmware-Version",
					ru: "Версия прошивки",
					pt: "Versão do firmware",
					nl: "Firmwareversie",
					fr: "Version du firmware",
					it: "Versione del firmware",
					es: "Versión de firmware",
					pl: "Wersja oprogramowania sprzętowego",
					uk: "Версія прошивки",
					"zh-cn": "固件版本",
				},
				type: "number",
				role: "info.firmware",
				read: true,
				write: false,
				unit: "",
			},
			native: {},
		});

		// Until the first broadcast message from EAS 3, set temperatur to -99 and status -1!
		await this.setState(cBrunnerEAS3HeizraumTemperatur, -99, true);
		await this.setState(cBrunnerEAS3AbbrandStatus, -1, true);

		// Create udp server socket object.
		this.server = dgram.createSocket("udp4");

		this.server.on("error", err => {
			this.log.error(`Server / socket error: ${err.stack}`);
		});

		this.server.bind(this.config.EASPortNumber);

		// When udp server started and listening.
		this.server.on("listening", () => {
			// Get and print udp server listening ip address and port number in log console.
			var address = this.server?.address();
			this.log.debug(`UDP Server started and listening on ${address?.address}:${address?.port}`);
		});

		this.log.debug(`Bind UDP successfully done`);

		// With EAS 3 FW-Version 3.25 new parameters are added
		var re =
			/<bdle eas.+stat="(\d+)">(\d+);(\d+);(\d+);(\d+);(\d+);(\d+);(\d+);(\d+);(\d+);(-?\d+);(\d+);(\d+);(\d+);?(\d*).+;<\/bdle>/;

		this.server.on("message", async message => {
			// Create output message.
			var sMessage = message.toString();
			var resultArray = re.exec(sMessage);
			if (resultArray != null) {
				// console.log( resultArray );
				// Array Index 0 enthält den ganzen match, ab 1 dann den Inhalt der Klammern
				// Index 1 Status, Index 14 Temperatur (letzter Wert in Aufzählung)

				// For the tempature we do NOT use setStateChanged, to have a timestamp of the last UDP packet!
				await this.setState(cBrunnerEAS3HeizraumTemperatur, parseInt(resultArray[14]), true);
				var iAbbrandStatus = parseInt(resultArray[1]);
				var AbbrandStatusAlt = await this.getStateAsync(cBrunnerEAS3AbbrandStatus);
				if (AbbrandStatusAlt && typeof AbbrandStatusAlt.val === "number") {
					if (iAbbrandStatus >= 2 && AbbrandStatusAlt.val >= 0 && AbbrandStatusAlt.val < 2) {
						// End of fire. Remember time
						await this.setState(cBrunnerEAS3LetzterAbbrandMS, { val: Date.now(), ack: true });
						await this.setState(cBrunnerEAS3LetzterAbbrand, {
							val: this.formatDate(Date.now(), "TT.MM.JJJJ SS:mm"),
							ack: true,
						});
					}
				}
				await this.setStateChangedAsync(cBrunnerEAS3AbbrandStatus, iAbbrandStatus, true);
				await this.setStateChangedAsync(cBrunnerEAS3Drosselklappe, parseInt(resultArray[4]), true);
				await this.setStateChangedAsync(cBrunnerEAS3Summer, parseInt(resultArray[6]) ? false : true, true);
				// 16-we could add more wood, after this phase 48. Meaning of 48 unclear...
				await this.setStateChangedAsync(cBrunnerEAS3HolzNachlegen, parseInt(resultArray[12]), true);
				await this.setStateChangedAsync(cBrunnerEAS3FirmwareVersion, parseInt(resultArray[9]), true);
				if (this.config.AddUDPString == true) {
					await this.setStateChangedAsync(cBrunnerEAS3Broadcast, sMessage, true);
				}
				// Connection to Brunner EAS 3 established
				await this.setStateChangedAsync(cBrunnerEAS3ConnectionState, true, true);
			} else {
				// this.log.debug(`Udp receive unknown message : ${sMessage}\n`);
				// setState( cBrunnerEAS3Broadcast2, sMessage, true );
			}
		});

		// Cyclic timer to check connection to EAS3
		this.timerConnectionId = setInterval(
			async () => {
				// if we have no updates for more than 2*60 seconds... than we have lost connection
				var BrennraumTemp = await this.getStateAsync(cBrunnerEAS3HeizraumTemperatur);
				if (BrennraumTemp && typeof BrennraumTemp.val === "number" && BrennraumTemp.val > -99) {
					if (Date.now() - BrennraumTemp.ts > 2 * 60 * 1000) {
						await this.setState(cBrunnerEAS3HeizraumTemperatur, -99, true);
						await this.setState(cBrunnerEAS3AbbrandStatus, -1, true);
						this.log.error(`Connection lost to Brunner EAS 3`);
						await this.setStateChangedAsync(cBrunnerEAS3ConnectionState, false, true);
					}
				}
			},
			2 * 60 * 1000,
		); // 2Min (time in Milliseconds)
	}

	// In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
	// this.subscribeStates("testVariable");
	// You can also add a subscription for multiple states. The following line watches all states starting with "lights."
	// this.subscribeStates("lights.*");
	// Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
	// this.subscribeStates("*");

	/*
		setState examples
		you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
	*/
	// the variable testVariable is set to true as command (ack=false)
	// await this.setState("testVariable", true);
	// same thing, but the value is flagged "ack"
	// ack should be always set to true if the value is received from or acknowledged from the target system
	// await this.setState("testVariable", { val: true, ack: true });

	// same thing, but the state is deleted after 30s (getState will return null afterwards)
	// await this.setState("testVariable", { val: true, ack: true, expire: 30 });
	// examples for the checkPassword/checkGroup functions
	// const pwdResult = await this.checkPasswordAsync("admin", "iobroker");
	// this.log.info(`check user admin pw iobroker: ${pwdResult}`);
	// const groupResult = await this.checkGroupAsync("admin", "admin");
	// this.log.info(`check group user admin group admin: ${groupResult}`);

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 *
	 * @param {() => void} callback - Callback function
	 */
	onUnload(callback) {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			// ...
			// clearInterval(interval1);
			// Clean up the socket
			if (this.server) {
				this.server.close();
				this.log.info("UDP port closed.");
				this.server = null;
			}
			// clean up connection timer
			if (this.timerConnectionId) {
				clearInterval(this.timerConnectionId);
				this.timerConnectionId = null;
			}
			callback();
		} catch (error) {
			this.log.error(`Error during unloading: ${error.message}`);
			callback();
		}
	}

	// If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
	// You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
	// /**
	//  * Is called if a subscribed object changes
	//  * @param {string} id
	//  * @param {ioBroker.Object | null | undefined} obj
	//  */
	// onObjectChange(id, obj) {
	// 	if (obj) {
	// 		// The object was changed
	// 		this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
	// 	} else {
	// 		// The object was deleted
	// 		this.log.info(`object ${id} deleted`);
	// 	}
	// }

	/**
	 * Is called if a subscribed state changes
	 *
	 * @param {string} id - State ID
	 * @param {ioBroker.State | null | undefined} state - State object
	 */
	onStateChange(id, state) {
		if (state) {
			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);

			if (state.ack === false) {
				// This is a command from the user (e.g., from the UI or other adapter)
				// and should be processed by the adapter
				this.log.info(`User command received for ${id}: ${state.val}`);

				// TODO: Add your control logic here
			}
		} else {
			// The object was deleted or the state value has expired
			this.log.info(`state ${id} deleted`);
		}
	}
	// If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  * @param {ioBroker.Message} obj
	//  */
	// onMessage(obj) {
	// 	if (typeof obj === "object" && obj.message) {
	// 		if (obj.command === "send") {
	// 			// e.g. send email or pushover or whatever
	// 			this.log.info("send command");

	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
	// 		}
	// 	}
	// }
}

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options] - Adapter options
	 */
	module.exports = options => new BrunnerEas3(options);
} else {
	// otherwise start the instance directly
	new BrunnerEas3();
}
