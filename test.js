var createRfid = require('./dist/index').createRfid;

// let rfid = new RFID('/dev/tty.usbserial');
//let rfid = createRfid('chafon','/dev/cu.usbmodem__wG9442_T3073');
let rfid = createRfid('chafon','/dev/ttyUSB0');


(async()=>{
	try {

	
	console.log("opening");
	await rfid.open();


	console.log("opened");
	// console.log("beeping...");
	// const beep=await rfid.beep();
	// console.log('beep',beep);

	console.log(" get info");
	const info=await rfid.getInfo();
	console.log('info',info);
	
	while (true){
		console.log("reading");
		const result=await rfid.read();
		console.log('result',result);
	}

	await rfid.close();
	}catch (e){
		console.error(e);
	}
})()
// /*rfid.open()
// 	.then((result) => {

// 		return rfid.write('AA345678AA').then(result => {
// 			console.log(result);
// 			rfid.close();
// 		});

// 	}).catch(e => {
// 		console.error(e);
// 		rfid.close();
// 	});
// 	*/

// rfid.on('data', (...data) => {
// 	console.log('Tag read', data);
// });
// rfid.on('error', (data) => {
// 	console.log('Error', data);
// });
// rfid.startReading(1);


// setTimeout(() => {
// 	rfid.close();

// }, 10000);