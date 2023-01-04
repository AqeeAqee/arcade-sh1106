game.stats=true
namespace sh1106 {

    // define consts
    export const WHITE = 1
    export const SSD1306_EXTERNALVCC = 0x1
    export const SSD1306_SWITCHCAPVCC = 0x2

    export const SSD1306_SETCONTRAST = 0x81
    export const SSD1306_DISPLAYALLON_RESUME = 0xA4
    export const SSD1306_DISPLAYALLON = 0xA5
    export const SSD1306_NORMALDISPLAY = 0xA6
    export const SSD1306_INVERTDISPLAY = 0xA7
    export const SSD1306_DISPLAYOFF = 0
    export const SSD1306_DISPLAYON = 0xAF
    export const SSD1306_SETDISPLAYOFFSET = 0xD3
    export const SSD1306_SETCOMPINS = 0xDA
    export const SSD1306_SETVCOMDETECT = 0xDB
    export const SSD1306_SETDISPLAYCLOCKDIV = 0xD5
    export const SSD1306_SETPRECHARGE = 0xD9
    export const SSD1306_SETMULTIPLEX = 0xA8
    export const SSD1306_SETLOWCOLUMN = 0x00
    export const SSD1306_SETHIGHCOLUMN = 0x10
    export const SSD1306_SETSTARTLINE = 0x40
    export const SSD1306_MEMORYMODE = 0x20
    export const SSD1306_COMSCANINC = 0xC0
    export const SSD1306_COMSCANDEC = 0xC8
    export const SSD1306_SEGREMAP = 0xA0
    export const SSD1306_CHARGEPUMP = 0x8D

    //tested with waveshare 1.3inch-OLED-HAT default spi 4-wire mode
    export class SH1106SPI {
        spi: SPI
        public readonly WIDTH:number =128
        public readonly HEIGHT:number=64
        _rotate:number
        public screen: Image
        buffer: Buffer

        public constructor(
            private rst:DigitalInOutPin, 
            private dc:DigitalInOutPin, 
            private cs:DigitalInOutPin, 
            external_vcc = SSD1306_EXTERNALVCC) {

            this.spi = pins.spi() //default SPI: MOSI=pins.P15, MISO=pins.P14, SCK=pins.P13
            // this.spi.setMode(2)  //whatever, default or 0~3 are the same result
            // this.spi.setFrequency(6000000) // default freq or > 6Mhz will reach the fastest fps(about 18)
            this.screen=image.create(this.WIDTH,this.HEIGHT)
            this.buffer = control.createBuffer(this.WIDTH * this.HEIGHT >>3)

            this.reset()  //required?
            this.init_display(external_vcc)
            this.rotate(0)
        }

        reset(){
            this.rst.digitalWrite(true)
            pause(1)
            this.rst.digitalWrite(false)
            pause(10)
            this.rst.digitalWrite(true)
        }

        command(b: number) {
            if (!this.spi) return;
            this.cs.digitalWrite(true)
            this.dc.digitalWrite(false)
            this.cs.digitalWrite(false)
            this.spi.write(b)
            this.cs.digitalWrite(true)
        }

        data(txBuf: Buffer) {
            let rxBuf = pins.createBuffer(txBuf.length)
            this.cs.digitalWrite(true)
            this.dc.digitalWrite(true)
            this.cs.digitalWrite(false)
            this.spi.transfer(txBuf, rxBuf)
            this.cs.digitalWrite(true)
        }

        init_display(vccstate: number) {
            this.command(sh1106.SSD1306_DISPLAYOFF)
            this.command(sh1106.SSD1306_SETDISPLAYCLOCKDIV)
            this.command(0x80)  // the suggested ratio 0x80

            this.command(sh1106.SSD1306_SETMULTIPLEX)
            this.command(this.HEIGHT - 1)

            this.command(sh1106.SSD1306_SETDISPLAYOFFSET)
            this.command(0x0)  // no offset

            this.command(sh1106.SSD1306_SETSTARTLINE | 0x0)  // line //0

            this.command(sh1106.SSD1306_CHARGEPUMP)

            this.command(vccstate == SSD1306_EXTERNALVCC ? 0x14 : 0x10)

            this.command(sh1106.SSD1306_MEMORYMODE)
            this.command(0x00)  // 0x0 act like ks0108

            // this.command(mySpi.SSD1306_SEGREMAP | 0x1)

            this.command(sh1106.SSD1306_COMSCANDEC)

            this.command(sh1106.SSD1306_SETCOMPINS)
            this.command(this.HEIGHT == 32 ? 0x02 : 0x12)  // TODO - calculate based on _rawHieght ?

            this.command(sh1106.SSD1306_SETCONTRAST)
            this.command(0x9F)

            this.command(sh1106.SSD1306_SETPRECHARGE)
            this.command(0x22)

            this.command(sh1106.SSD1306_SETVCOMDETECT)
            this.command(0x40)

            this.command(sh1106.SSD1306_DISPLAYALLON_RESUME)

            this.command(sh1106.SSD1306_NORMALDISPLAY)

            this.command(sh1106.SSD1306_DISPLAYON)

            // display()
            this.command(sh1106.SSD1306_SETLOWCOLUMN | 0x2)  // low col = 0
            this.command(sh1106.SSD1306_SETHIGHCOLUMN | 0x0)  // hi col = 0
            this.command(sh1106.SSD1306_SETSTARTLINE | 0x0)  // line //0
        }

        rotate(rotate:number) {
            this._rotate = rotate
            this.command(sh1106.SSD1306_COMSCANINC | ((rotate & 1) << 3))
            this.command(sh1106.SSD1306_SEGREMAP | (rotate & 1))
        }

        //deprecated, cause show() recover buffer with screen image
        private clear(){
            this.buffer.fill(0)
        }

        //deprecated, cause show() recover buffer with screen image
        private setPixel(x: number, y:number, c:number){
            let valueByte= this.buffer.getUint8((Math.idiv(y,8)*this.WIDTH+x))
            if(c)
                valueByte |= 1<<(y%8)
            else
                valueByte &= ~(1 << (y % 8))
            this.buffer.setUint8((Math.idiv(y, 8) * this.WIDTH + x), valueByte)
        }

        screenToBuffer(){
            const rowBuf=control.createBuffer(this.HEIGHT)
            for (let sx = 0; sx < this.WIDTH; sx++) {
                this.screen.getRows(sx, rowBuf)
                for (let sy = 0; sy < this.HEIGHT; sy+=8) {
                    let valueByte2=0
                    let bit=1
                    for (let i = 0; i < 8; i++) {
                        const c = rowBuf.getUint8(sy + i)
                        if (c)
                            valueByte2|=bit
                        bit<<=1
                    }
                    this.buffer.setUint8((sy>>3)*this.WIDTH+sx, valueByte2)
                }
            }
        }

        drawImage(image:Image, x:number ,y:number,darkColors:number[]=[],autoShow:boolean=true) {
            this.screen.drawImage(image, x, y)
            if(darkColors)
                // about 4~5ms, 16 colors -> 2 colors
                darkColors.forEach((c) => { this.screen.replace(c, 0) })
            if(autoShow)
                this.show()
        }

        show() {
            this.screenToBuffer()
            // aqee tuned, tested, but maybe bug inside:)
            const m_col = 2
            this.command(1)  // send a bunch of data in one xmission
            for (let j = 0; j < this.HEIGHT >> 3; j++) {
                this.command(sh1106.SSD1306_SETLOWCOLUMN | (m_col & 0xF))   // set lower column address
                this.command(sh1106.SSD1306_SETHIGHCOLUMN )  // set higher column address
                this.command(0xB0 + j)  // set page address
                this.data(this.buffer.slice(j * this.WIDTH, this.WIDTH))
            }
        }
    }

}
