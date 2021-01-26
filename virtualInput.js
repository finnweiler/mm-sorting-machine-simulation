
const Gpio = require('onoff').Gpio;

const outputs = {
    segmentSerialInputPin: new Gpio(2, 'out'),
    segmentShiftRegisterPin: new Gpio(3, 'out'),
    segmentClearRegisterPin: new Gpio(4, 'out'), // n
    segmentStoreRegisterPin: new Gpio(5, 'out'),
    segmentBit0Pin: new Gpio(6, 'out'),
    segmentBit1Pin: new Gpio(14, 'out'),

    outletActivePin: new Gpio(11, 'out'), // n
    outletStepPin: new Gpio(12, 'out', { debounceTimeout: 50 }),
    outletDirectionPin: new Gpio(26, 'out'),

    feederEnabled: new Gpio(19, 'out'),

    cwStepPin: new Gpio(13, 'out'),
    cwDirectionPin: new Gpio(16, 'out'),
    cwActivePin: new Gpio(17, 'out'), // n
    ledSig: new Gpio(18, 'out'),

    sleepPin: new Gpio(27, 'out') // n
}


const cliSelect = require('cli-select');
const chalk = require('chalk');
 
function selectPin(defaultValue) {
    cliSelect({
        values: [
            'segmentSerialInputPin',
            'segmentShiftRegisterPin',
            'segmentClearRegisterPin',
            'segmentStoreRegisterPin',
            'segmentBit0Pin',
            'segmentBit1Pin',
            'outletActivePin',
            'outletStepPin',
            'outletDirectionPin',
            'feederEnabled',
            'cwStepPin',
            'cwDirectionPin',
            'cwActivePin',
            'ledSig',
            'sleepPin'
        ],
        defaultValue: defaultValue,
        selected: chalk.red(' ➜ '),
        unselected: '   ',
        indentation: 1,
        valueRenderer: (value, selected) => {

            if (outputs[value].readSync()) {
                return chalk.green(value);
            }

            return value;
        },
    }).then(response => {
        const pin = outputs[response.value];
        pin.writeSync(pin.readSync() === 0 ? 1 : 0);
        selectPin(response.id);
    }).catch(error => {
        if (error != undefined) {
            console.log(error);
        }
    });
}

selectPin(0)

/*
setInterval(() => {
    outputs.cwStepPin.writeSync(outputs.cwStepPin.readSync() === 0 ? 1 : 0)
}, 1);
*/