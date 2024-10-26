// import { parsers } from 'serialport'
import * as Debug from 'debug'
import { EventEmitter } from 'events'

import { RFIDReader } from './rfid'

import { Transform, TransformCallback } from 'stream'
import { timingSafeEqual } from 'crypto'

const CMD_INFO = 'AADD0003010203'

const CMD_BEEP = 'AADD000401030A08'

const CMD_READ = 'AADD0003010C0D'

// const debug = Debug('ulfalfa:rfid:chafon')
// const debug2 = Debug('ulfalfa:rfid:chafon:parser')


interface ChafonResult {
  data: Buffer
  id: string
  length: number
  crc: boolean
}

class ChafonParser extends Transform {
  buffer = Buffer.alloc(50)
  byteCount = 0
  constructor() {
    super({ objectMode: true })
  }

  parse() {
    const id = this.buffer.readUInt16BE(0).toString(16)
    const length = this.buffer.readUInt16BE(2)

    let csum
    let skipNext = false
    let pointer = 0
    const data = Buffer.alloc(50)
    for (let i = 4; i < this.buffer.length; i++) {
      // tslint:disable-next-line
      csum = csum ^ this.buffer[i]
      if (skipNext && this.buffer[i].toString(16) === '0') {
        skipNext = false
      } else {
        data[pointer] = this.buffer[i]
        pointer++
      }

      if (this.buffer[i].toString(16) === 'aa') {
        skipNext = true
      }
    }

    console.log(
      `Message ${id} with length ${length} arrived (CSUM:${csum === 0}) = `,
      data
    )
    this.push({ data: data.slice(0, length), id, length, crc: csum === 0 })
  }

  _transform(
    chunk: Buffer,
    encoding: string,
    callback: TransformCallback
  ): void {
    console.log(
      `Chunk arrived with ${chunk.length} byte, we alreay have ${
        this.byteCount
      }`,
      chunk
    )

    chunk.copy(this.buffer, this.byteCount)
    this.byteCount += chunk.length

    if (
      this.byteCount > 4 &&
      this.buffer.readUInt16BE(2) === this.byteCount - 4
    ) {
      console.log('Message complete')
      this.parse()

      this.byteCount = 0
      this.buffer = Buffer.alloc(50)
    }

    callback()
  }
}

export class ChafonReader extends RFIDReader {
  parser: ChafonParser

  constructor(port = '/dev/ttyUSB0') {
    super(port, 57600)

    this.parser = new ChafonParser()
    this.serialPort.pipe(this.parser)
  }

  public doCommand(cmdString: string | Buffer): Promise<ChafonResult> {
    const cmd =
      typeof cmdString === 'string' ? Buffer.from(cmdString, 'hex') : cmdString
    return new Promise((resolve, reject) => {
      this.parser.once('data', resolve)

      console.debug('>Send Command', cmd)
      this.serialPort.write(cmd, (err) => {
        if (err) {
          reject(err)
        }
      })
    }).then(data => {
      console.debug('< returned', data)
      return data as ChafonResult
    })
  }

  getInfo(): Promise<any> {
    return this.doCommand(CMD_INFO).then(data => {
      return data.data.slice(3).toString()
    })
  }

  beep() {
    return this.doCommand(CMD_BEEP)
  }

  read(): Promise<string> {
    console.debug('Entered Read')

    return this.doCommand(CMD_READ).then(data => {
      if (!data.crc) {
        throw new Error('CRCERROR')
      } else if (data.data[2] === 1) {
        return undefined
      } else {
        return data.data
          .slice(3, 8)
          .toString('hex')
          .toUpperCase()
      }
    })
  }

  protected atomicWrite(id: string): Promise<void> {
    console.debug('Entered AtomicWrite')

    const cmdBuffer = Buffer.alloc(50)
    cmdBuffer.write('AADD0009', 'hex')
    let pos = 4
    // now write the compose the id for checksum
    const idBuffer = Buffer.alloc(8)
    idBuffer.write('030C00', 'hex')
    idBuffer.write(id, 3, 'hex')

    // now calculate checksum and fill cmdBuffer and doubling the 0xAA
    let csum = 0
    for (const part of idBuffer) {
      // tslint:disable-next-line
      csum = csum ^ part
      cmdBuffer[pos] = part
      pos++
      // double the AAs
      if (part.toString(16) === 'aa') {
        cmdBuffer[pos] = part
        pos++
      }
    }

    cmdBuffer[pos] = csum
    pos++

    return this.doCommand(cmdBuffer.slice(0, pos)).then(data => {
      console.debug('Write Result', data)
      return
    })
  }
}
