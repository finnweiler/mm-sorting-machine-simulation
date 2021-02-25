/** config */
const OUTLET_ROTATION_STEPS = 400;
const CW_ROTATION_STEPS = 1600;
const HALL_TOLERANCE = 20;

const COLORS = ['red', 'green', 'blue', 'brown', 'orange', 'yellow'];

/** pins */

const Gpio = require('onoff').Gpio;

const segmentSerialInputPin = new Gpio(2, 'in', 'both');       // 7-Segment
const segmentShiftRegisterPin = new Gpio(3, 'in', 'rising');     // Clock input for register shift
const segmentClearRegisterPin = new Gpio(4, 'in', 'both', { activeLow: true });    //
const segmentStoreRegisterPin = new Gpio(5, 'in', 'both');         //
const segmentBit0Pin = new Gpio(6, 'in', 'both');            //
const segmentBit1Pin = new Gpio(14, 'in', 'both'); // eig. Pin 7

const button1Pin = new Gpio(15, 'out', { activeLow: true });  // eig. Pin 8
const button2Pin = new Gpio(9, 'out', { activeLow: true });   //
const button3Pin = new Gpio(10, 'out', { activeLow: true });  //

const outletActivePin = new Gpio(11, 'in', 'none', { activeLow: true }); 
const outletStepPin = new Gpio(12, 'in', 'falling'); // { debounceTimeout: 5 }
const outletDirectionPin = new Gpio(26, 'in', 'none');

const cwActivePin = new Gpio(17, 'in', 'both', { activeLow: true });
const cwStepPin = new Gpio(13, 'in', 'falling'); // { debounceTimeout: 5 }
const cwDirectionPin = new Gpio(16, 'in', 'none'); 
const cwObject = new Gpio(25, 'out');

const ledSig = new Gpio(18, 'in', 'both'); // LED-Color

const feederEnabled = new Gpio(19, 'in', 'both'); // Feeder

const hallColorWheel = new Gpio(20, 'out', { activeLow: true }); // Hallsensor Color-Wheel
const hallOutlet = new Gpio(21, 'out', { activeLow: true }); // Hallsensor der Outlets

const colorBit0Pin = new Gpio(22, 'out'); // Farberkennung
const colorBit1Pin = new Gpio(23, 'out'); // 
const colorBit2Pin = new Gpio(24, 'out'); //


const sleepPin = new Gpio(27, 'in', 'both', { activeLow: true }); // Sleep-Signal


/** variables */

let outletStepCount = 0;
let cwStepCount = 0;
let currentDetectedColor = 0;

let segmentRegister = 0b0;
let segmentOutput = 0b0;

let lastValueSegment0 = 0b0;
let lastValueSegment1 = 0b0;
let lastValueSegment2 = 0b0;
let lastValueSegment3 = 0b0;

/** pin handlers */

function initPinStates() {
    updateHallOutlet();
}

initPinStates();

outletStepPin.watch((err, value) => {
    if (outletActivePin.readSync()) {
        //console.log('[Warning] Stepping, while outlet is not active!')
        //return;
    }
    if (!outletDirectionPin.readSync()) {
        outletStepCount++;
        if (outletStepCount > OUTLET_ROTATION_STEPS - 1) {
            outletStepCount = 0;
        }
    } else {
        outletStepCount--;
        if (outletStepCount < 0) {
            outletStepCount = OUTLET_ROTATION_STEPS - 1
        }
    }
    updateHallOutlet();
});

function updateHallOutlet() { 
    if (outletStepCount <= HALL_TOLERANCE || outletStepCount >= OUTLET_ROTATION_STEPS - HALL_TOLERANCE) {
        hallOutlet.writeSync(1);
    } else {
        hallOutlet.writeSync(0);
    }
}

cwStepPin.watch((err, value) => {
    if (cwActivePin.readSync()) {
        //console.log('[Warning] Stepping, while outlet is not active!')
        //return;
    }
    if (!cwDirectionPin.readSync()) {
        cwStepCount++;
        if (cwStepCount > CW_ROTATION_STEPS - 1) {
            cwStepCount = 0;
        }
    } else {
        cwStepCount--;
        if (cwStepCount < 0) {
            cwStepCount = CW_ROTATION_STEPS - 1
        }
    }
    updateHallCw();
});

function updateHallCw() {
    const quater = (CW_ROTATION_STEPS / 4)
    if (cwStepCount % quater <= HALL_TOLERANCE * 4 || cwStepCount % quater >= quater - HALL_TOLERANCE * 4) {
        hallColorWheel.writeSync(1);
    } else {
        hallColorWheel.writeSync(0);
    }
}

// Called every time the segment register should shift
segmentShiftRegisterPin.watch((err, value) => {
    if (segmentClearRegisterPin.readSync()) {
        segmentRegister = 0b0;
    } else {
        segmentRegister = (segmentRegister << 1) + segmentSerialInputPin.readSync();
    }
});

// Called every time the register should be stored
segmentStoreRegisterPin.watch((err, value) => {
    segmentOutput = segmentRegister;
    segmentMultiplexDidChange(segmentBit1Pin.readSync(), segmentBit0Pin.readSync());
});

segmentBit0Pin.watch((err, value) => segmentMultiplexDidChange(segmentBit1Pin.readSync(), value));
segmentBit1Pin.watch((err, value) => segmentMultiplexDidChange(value, segmentBit0Pin.readSync()));

function segmentMultiplexDidChange(bit1, bit0) {
    switch ((bit1 << 1) + bit0) {
        case 0b00: return lastValueSegment0 = segmentOutput;
        case 0b01: return lastValueSegment1 = segmentOutput;
        case 0b10: return lastValueSegment2 = segmentOutput;
        case 0b11: return lastValueSegment3 = segmentOutput;
        default: return
    }
}

// feeder progress


/** pin setters */

function setColor(color) {
    let bits;
    switch (color) {
        case 1: bits = [0,0,1]; break;
        case 2: bits = [0,1,0]; break;
        case 3: bits = [0,1,1]; break;
        case 4: bits = [1,0,0]; break;
        case 5: bits = [1,0,1]; break;
        case 6: bits = [1,1,0]; break;
        default: 
            bits = [0,0,0]
            color = undefined
            console.log('[Warning] Setting unkown color string.')
    }
    const [bit2, bit1, bit0] = bits;
    colorBit0Pin.writeSync(bit0);
    colorBit1Pin.writeSync(bit1);
    colorBit2Pin.writeSync(bit2);
    currentDetectedColor = color;
}

/** update front-end */

const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
    console.log('a user connected');
    /** recieve simulation data */
    socket.on('updateColor', (newColor) => {
        setColor(newColor)
    });
});

http.listen(80, () => {
    console.log('listening on *:80');
});

function segmentToNumber(segmentValue) {
    switch (segmentValue & 0b01111111) {
        //     .GFEDCBA
        case 0b00000000: return '0'
        case 0b00000110: return '1'
        case 0b01011011: return '2'
        case 0b01001111: return '3'
        case 0b01100110: return '4'
        case 0b01101101: return '5'
        case 0b01111101: return '6'
        case 0b01110000: return '7'
        case 0b01111111: return '8'
        case 0b01101111: return '9'
        default: return 'E'
    }
}

function createBinaryString(number) {
    let string = number.toString(2);
    while (string.length < 8) {
        string = '0' + string;
    }
    return string;
  }

const socketUpdateInterval = setInterval(updateSocket, 100);

function consoleInfo() {
    return `
    Step Count:\t\t${outletStepCount} of ${OUTLET_ROTATION_STEPS} steps         
    Rotation:\t\t${(Math.round(outletStepCount / OUTLET_ROTATION_STEPS * 360))%360}°  
    Hall Outlet:\t${hallOutlet.readSync()}     
    
    Step Count:\t\t${cwStepCount} of ${CW_ROTATION_STEPS} steps         
    Rotation:\t\t${(Math.round(cwStepCount / CW_ROTATION_STEPS * 360))%360}°  
    Hall Outlet:\t${hallColorWheel.readSync()}     

    Current Color:\t${currentDetectedColor} => ${currentDetectedColor === 0 ? 'N/A' : COLORS[currentDetectedColor - 1]} ${colorBit2Pin.readSync()}${colorBit1Pin.readSync()}${colorBit0Pin.readSync()}         
    
    Segment Display:\t${segmentToNumber(lastValueSegment0)} | ${segmentToNumber(lastValueSegment1)} | ${segmentToNumber(lastValueSegment2)} | ${segmentToNumber(lastValueSegment3)}
    
    Segment Register:\t${createBinaryString(segmentRegister)} ${segmentSerialInputPin.readSync()}
    Segment Output:\t${createBinaryString(segmentOutput)}

    Segment 0:\t\t${createBinaryString(lastValueSegment0)}
    Segment 1:\t\t${createBinaryString(lastValueSegment1)}
    Segment 2:\t\t${createBinaryString(lastValueSegment2)}
    Segment 3:\t\t${createBinaryString(lastValueSegment3)}

    Sleeping:\t\t${sleepPin.readSync()}          

    Buttons:\t\t${button1Pin.readSync()} | ${button2Pin.readSync()} | ${button3Pin.readSync()}        
    `
}

require('draftlog').into(console)
const consoleOutput = console.draft(consoleInfo());

function updateSocket() {
    consoleOutput(consoleInfo());
    io.emit('update', {
        outletRotation: outletStepCount / OUTLET_ROTATION_STEPS,
        cwRotation: cwStepCount / CW_ROTATION_STEPS
    })
}




/*
let counter = 0
setInterval(() => {
    segmentSerialInputPin.writeSync(counter%2);
    counter ++;
}, 1000)*/

/** boilerplate */

/*
for (let index = 1; index <= 27; index++) {
    if (index === 7 || index === 8) {
        continue;
    }
    var LED = new Gpio(index, 'out');
    LED.writeSync(1);
    console.info(`Written to LED ${index}`);
}
}

setTimeout(() => {
    console.log('Test complete!');
}, 2000);
*/
