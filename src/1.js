// 1.js

"use strict";

// Vertex shader program
const VSHADER_SOURCE =
    'attribute vec4 a_Position;\n' +
    'attribute float a_select;\n' +
    'uniform mat4 u_projMatrix;\n' +
    'uniform float u_pointSize;\n' +
    'uniform vec4 u_color;\n' +
    'uniform vec4 u_colorSelect;\n' +
    'varying vec4 v_color;\n' +
    'void main() {\n' +
    '  gl_Position = u_projMatrix * a_Position;\n' +
    '  gl_PointSize = u_pointSize;\n' +
    '  if (a_select != 0.0)\n' +
    '    v_color = u_colorSelect;\n' +
    '  else\n' +
    '    v_color = u_color;\n' +
    '}\n';

// Fragment shader program
const FSHADER_SOURCE =
    'precision mediump float;\n' +
    'varying vec4 v_color;\n' +
    'void main() {\n' +
    '  gl_FragColor = v_color;\n' +
    '}\n';

function main() {
    // Retrieve <canvas> element
    const canvas = document.getElementById('webgl');

    // Get the rendering context for WebGL
    const gl = getWebGLContext(canvas);
    if (!gl) {
        console.log('Failed to get the rendering context for WebGL');
        return;
    }

    // Initialize shaders
    if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
        console.log('Failed to intialize shaders.');
        return;
    }

    gl.viewport(0, 0, canvas.width, canvas.height);

    const projMatrix = mat4.ortho(mat4.create(), 0, gl.drawingBufferWidth, 0, gl.drawingBufferHeight, 0, 1);

    // Pass the projection matrix to the vertex shader
    const u_projMatrix = gl.getUniformLocation(gl.program, 'u_projMatrix');
    if (!u_projMatrix) {
        console.log('Failed to get the storage location of u_projMatrix');
        return;
    }
    gl.uniformMatrix4fv(u_projMatrix, false, projMatrix);

    const countSplinePoints = document.getElementById("countSplinePoints");
    const uniform = document.getElementById("uniform");
    const chordal = document.getElementById("chordal");
    const centripetal = document.getElementById("centripetal");

    Data.init(gl, countSplinePoints, uniform, chordal, centripetal);

    // Register function (event handler) to be called on a mouse press
    canvas.onclick = function (ev) { click(ev, canvas); };

    canvas.onmousemove = function (ev) { mousemove(ev, canvas); };

    canvas.onmousedown = function (ev) { mousedown(ev, canvas); };

    canvas.onmouseup = function (ev) { mouseup(ev, canvas); };

    const lineSpline = document.getElementById("chkLineSpline");
    const controlPolygon = document.getElementById("chkControlPolygon");
    const showControlPoints = document.getElementById("chkShowPoints");
    const visualizeSplineWithPoints = document.getElementById("chkVisualizeWithPoints");
    const visualizeSplineWithLines = document.getElementById("chkVisualizeWithLine");

    lineSpline.onclick = function () { Data.plotMode(1); };
    countSplinePoints.onchange = function () { Data.plotMode(2); };
    uniform.onclick = function () { Data.plotMode(2); };
    chordal.onclick = function () { Data.plotMode(2); };
    centripetal.onclick = function () { Data.plotMode(2); };
    controlPolygon.onclick = function () { Data.plotMode(3); };
    visualizeSplineWithPoints.onclick = function () { Data.plotMode(4); };
    visualizeSplineWithLines.onclick = function () { Data.plotMode(5); };
    showControlPoints.onclick = function () { Data.plotMode(6); };

    // Specify the color for clearing <canvas>
    gl.clearColor(0.8, 0.8, 0.8, 1.0);

    // Clear <canvas>
    gl.clear(gl.COLOR_BUFFER_BIT);
}

class Point {
    constructor(x, y) {
        this.select = false;
        this.x = x;
        this.y = y;
        this.setRect();
    }
    setPoint(x, y) {
        this.x = x;
        this.y = y;
        this.setRect();
    }
    setRect() {
        this.left = this.x - 5;
        this.right = this.x + 5;
        this.bottom = this.y - 5;
        this.up = this.y + 5;
    }
    ptInRect(x, y) {
        const inX = this.left <= x && x <= this.right;
        const inY = this.bottom <= y && y <= this.up;
        return inX && inY;
    }
}

const Data = {
    pointsCtr: [],
    pointsSpline: [],
    countAttribData: 3, //x,y,sel
    verticesCtr: {},
    verticesSpline: {},
    FSIZE: 0,
    gl: null,
    vertexBufferCtr: null,
    vertexBufferSpline: null,
    a_Position: -1,
    a_select: -1,
    u_color: null,
    u_colorSelect: null,
    u_pointSize: null,
    movePoint: false,
    iMove: -1,
    leftButtonDown: false,
    drawControlPolygon: false,
    drawLineSpline: false,
    showControlPoints: true,
    visualizeSplineWithPoints: true,
    visualizeSplineWithLine: false,
    countSplinePoints: null,
    uniform: null,
    chordal: null,
    centripetal: null,
    init: function (gl, countSplinePoints, uniform, chordal, centripetal) {
        this.gl = gl;
        // Create a buffer object
        this.vertexBufferCtr = this.gl.createBuffer();
        if (!this.vertexBufferCtr) {
            console.log('Failed to create the buffer object for control points');
            return -1;
        }
        this.vertexBufferSpline = this.gl.createBuffer();
        if (!this.vertexBufferSpline) {
            console.log('Failed to create the buffer object for spline points');
            return -1;
        }

        this.a_Position = this.gl.getAttribLocation(this.gl.program, 'a_Position');
        if (this.a_Position < 0) {
            console.log('Failed to get the storage location of a_Position');
            return -1;
        }

        this.a_select = this.gl.getAttribLocation(this.gl.program, 'a_select');
        if (this.a_select < 0) {
            console.log('Failed to get the storage location of a_select');
            return -1;
        }

        // Get the storage location of u_color
        this.u_color = this.gl.getUniformLocation(this.gl.program, 'u_color');
        if (!this.u_color) {
            console.log('Failed to get u_color variable');
            return;
        }

        // Get the storage location of u_colorSelect
        this.u_colorSelect = gl.getUniformLocation(this.gl.program, 'u_colorSelect');
        if (!this.u_colorSelect) {
            console.log('Failed to get u_colorSelect variable');
            return;
        }

        // Get the storage location of u_pointSize
        this.u_pointSize = gl.getUniformLocation(this.gl.program, 'u_pointSize');
        if (!this.u_pointSize) {
            console.log('Failed to get u_pointSize variable');
            return;
        }

        this.countSplinePoints = countSplinePoints;
        this.uniform = uniform;
        this.chordal = chordal;
        this.centripetal = centripetal;
    },
    setLeftButtonDown: function (value) {
        this.leftButtonDown = value;
    },
    add_coords: function (x, y) {
        const pt = new Point(x, y);
        this.pointsCtr.push(pt);
        this.add_vertices();
    },
    mousemoveHandler: function (x, y) {
        if (this.leftButtonDown) {
            if (this.movePoint) {
                this.pointsCtr[this.iMove].setPoint(x, y);

                this.verticesCtr[this.iMove * this.countAttribData] = this.pointsCtr[this.iMove].x;
                this.verticesCtr[this.iMove * this.countAttribData + 1] = this.pointsCtr[this.iMove].y;

                this.setVertexBuffersAndDraw();

                if (this.drawLineSplines)
                    this.calculateLineSpline();
            }
        }
        else
            for (let i = 0; i < this.pointsCtr.length; i++) {
                this.pointsCtr[i].select = false;

                if (this.pointsCtr[i].ptInRect(x, y))
                    this.pointsCtr[i].select = true;

                this.verticesCtr[i * this.countAttribData + 2] = this.pointsCtr[i].select;

                this.setVertexBuffersAndDraw();
            }
    },
    mousedownHandler: function (button, x, y) {

        if (button == 0) { //left button
            this.movePoint = false;

            for (let i = 0; i < this.pointsCtr.length; i++) {
                if (this.pointsCtr[i].select == true) {
                    this.movePoint = true;
                    this.iMove = i;
                }
            }

            this.setLeftButtonDown(true);
        }



    },
    mouseupHandler: function (button, x, y) {
        if (button == 0) //left button
            this.setLeftButtonDown(false);
    },
    clickHandler: function (x, y) {
        if (!this.movePoint) {
            this.add_coords(x, y);
            if (this.drawLineSplines)
                this.calculateLineSpline();
            this.setVertexBuffersAndDraw();
        }
    },
    add_vertices: function () {
        this.verticesCtr = new Float32Array(this.pointsCtr.length * this.countAttribData);
        
        for (let i = 0; i < this.pointsCtr.length; i++) {
            this.verticesCtr[i * this.countAttribData] = this.pointsCtr[i].x;
            this.verticesCtr[i * this.countAttribData + 1] = this.pointsCtr[i].y;
            this.verticesCtr[i * this.countAttribData + 2] = this.pointsCtr[i].select;
        }
        this.FSIZE = this.verticesCtr.BYTES_PER_ELEMENT;
    },
    setVertexBuffersAndDraw: function () {
        if (this.pointsCtr.length == 0)
            return;

        // Bind the buffer object to target
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBufferCtr);
        // Write date into the buffer object
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.verticesCtr, this.gl.DYNAMIC_DRAW);
        // Assign the buffer object to a_Position variable
        this.gl.vertexAttribPointer(this.a_Position, 2, this.gl.FLOAT, false, this.FSIZE * 3, 0);
        // Enable the assignment to a_Position variable
        this.gl.enableVertexAttribArray(this.a_Position);
        // Assign the buffer object to a_select variable
        this.gl.vertexAttribPointer(this.a_select, 1, this.gl.FLOAT, false, this.FSIZE * 3, this.FSIZE * 2);
        // Enable the assignment to a_select variable
        this.gl.enableVertexAttribArray(this.a_select);

        // Clear <canvas>
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        this.gl.uniform4f(this.u_color, 0.0, 0.0, 0.0, 1.0);
        this.gl.uniform4f(this.u_colorSelect, 0.5, 0.5, 0.0, 1.0);
        this.gl.uniform1f(this.u_pointSize, 10.0);
        // Draw
        if (this.showControlPoints)
        	this.gl.drawArrays(this.gl.POINTS, 0, this.pointsCtr.length);
        if (this.drawControlPolygon) {
            this.gl.uniform4f(this.u_color, 0.0, 0.0, 0.0, 1.0);
            this.gl.uniform4f(this.u_colorSelect, 0.0, 0.0, 0.0, 1.0);

            this.gl.drawArrays(this.gl.LINE_STRIP, 0, this.pointsCtr.length);
        }
        if (this.drawLineSplines) {
            // Bind the buffer object to target
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBufferSpline);
            // Write date into the buffer object
            this.gl.bufferData(this.gl.ARRAY_BUFFER, this.verticesSpline, this.gl.DYNAMIC_DRAW);
            // Assign the buffer object to a_Position variable
            this.gl.vertexAttribPointer(this.a_Position, 2, this.gl.FLOAT, false, 0, 0);
            // Enable the assignment to a_Position variable
            this.gl.enableVertexAttribArray(this.a_Position);
            // Disable the assignment to a_select variable
            this.gl.disableVertexAttribArray(this.a_select);

            this.gl.uniform4f(this.u_color, 1.0, 0.0, 0.0, 1.0);
            this.gl.uniform1f(this.u_pointSize, 7.0);

            if (this.visualizeSplineWithPoints)
                this.gl.drawArrays(this.gl.POINTS, 0, this.pointsSpline.length);

            if (this.visualizeSplineWithLine)
                this.gl.drawArrays(this.gl.LINE_STRIP, 0, this.pointsSpline.length);
        }
    },
    plotMode: function (selOption) {
        switch (selOption) {
            case 1:
                this.drawLineSplines = !this.drawLineSplines;
                if (this.drawLineSplines)
                    this.calculateLineSpline();
                break;
            case 2:
                if (this.drawLineSplines)
                    this.calculateLineSpline();
                break;
            case 3:
                this.drawControlPolygon = !this.drawControlPolygon;
                break;
            case 4:
                this.visualizeSplineWithPoints = !this.visualizeSplineWithPoints;
                break;
            case 5:
                this.visualizeSplineWithLine = !this.visualizeSplineWithLine;
                break;
            case 6:
                this.showControlPoints = !this.showControlPoints;
                break;
        }
        this.setVertexBuffersAndDraw();
    },
    calculateLineSpline: function () {
        let i, j;
        let pt;
        let t, x, y, dt;
		let d = 0;
		let d1 = 0;

        this.pointsCtr[this.pointsCtr.length-1].t = this.pointsCtr[0].t
        this.pointsCtr[this.pointsCtr.length-1].x = this.pointsCtr[0].x
        this.pointsCtr[this.pointsCtr.length-1].y = this.pointsCtr[0].y
		for (i = 1; i < this.pointsCtr.length; i++){
			d += Math.hypot(this.pointsCtr[i].x - this.pointsCtr[i-1].x,this.pointsCtr[i].y - this.pointsCtr[i-1].y);
			d1 += (Math.sqrt(Math.hypot(this.pointsCtr[i].x - this.pointsCtr[i-1].x,this.pointsCtr[i].y - this.pointsCtr[i-1].y)));
		}
		for (i = 0; i < this.pointsCtr.length; i++){
			if (this.uniform.checked)
				this.pointsCtr[i].t = i / (this.pointsCtr.length);
		}
		for (i = 1;i<this.pointsCtr.length; i++){
			if (this.chordal.checked){
				this.pointsCtr[0].t = 0;
				this.pointsCtr[i].t = this.pointsCtr[i-1].t + (Math.hypot(this.pointsCtr[i].x - this.pointsCtr[i-1].x,this.pointsCtr[i].y - this.pointsCtr[i-1].y))/d;
			}
			if (this.centripetal.checked){
				this.pointsCtr[0].t = 0;
				this.pointsCtr[i].t = this.pointsCtr[i-1].t + (Math.sqrt(Math.hypot(this.pointsCtr[i].x - this.pointsCtr[i-1].x,this.pointsCtr[i].y - this.pointsCtr[i-1].y)))/d1;
			}
		}

        const N = this.countSplinePoints.value;
        this.pointsSpline = new Array(N);
		dt = (this.pointsCtr[this.pointsCtr.length-1].t - this.pointsCtr[0].t)/(N-1);
		i = 0;
		t = 0;
		

        let h = [];
        let dp0 = new Point();
        dp0.x = (this.pointsCtr[1].x - this.pointsCtr[0].x) / (this.pointsCtr[1].t - this.pointsCtr[0].t)
        dp0.y = (this.pointsCtr[1].y - this.pointsCtr[0].y) / (this.pointsCtr[1].t - this.pointsCtr[0].t)
        let dp1 = new Point();
        dp1.x = (this.pointsCtr[2].x - this.pointsCtr[1].x) / (this.pointsCtr[2].t - this.pointsCtr[1].t)
        dp1.y = (this.pointsCtr[2].y - this.pointsCtr[1].y) / (this.pointsCtr[2].t - this.pointsCtr[1].t)   
        let ddp0 = new Point();
        ddp0.x = (dp1.x - dp0.x) / (this.pointsCtr[1].t - this.pointsCtr[0].t)
        ddp0.y = (dp1.y - dp0.y) / (this.pointsCtr[1].t - this.pointsCtr[0].t)  

        let dpn = new Point();
        dpn.x = (this.pointsCtr[this.pointsCtr.length-1].x - this.pointsCtr[this.pointsCtr.length-2].x) 
        / (this.pointsCtr[this.pointsCtr.length-1].t - this.pointsCtr[this.pointsCtr.length-2].t)
        dpn.y = (this.pointsCtr[this.pointsCtr.length-1].y - this.pointsCtr[this.pointsCtr.length-2].y) 
        / (this.pointsCtr[this.pointsCtr.length-1].t - this.pointsCtr[this.pointsCtr.length-2].t)
        let dpn_1 = new Point();
        dpn_1.x = (this.pointsCtr[this.pointsCtr.length-2].x - this.pointsCtr[this.pointsCtr.length-3].x) 
        / (this.pointsCtr[this.pointsCtr.length-2].t - this.pointsCtr[this.pointsCtr.length-3].t)
        dpn_1.y = (this.pointsCtr[this.pointsCtr.length-2].y - this.pointsCtr[this.pointsCtr.length-3].y) 
        / (this.pointsCtr[this.pointsCtr.length-2].t - this.pointsCtr[this.pointsCtr.length-3].t)   
        let ddpn = new Point();
        ddpn.x = (dpn.x - dpn_1.x) / (this.pointsCtr[this.pointsCtr.length-1].t - this.pointsCtr[this.pointsCtr.length-2].t)
        ddpn.y = (dpn.y - dpn_1.y) / (this.pointsCtr[this.pointsCtr.length-1].t - this.pointsCtr[this.pointsCtr.length-2].t)  

        let a_x = [0];
        let b_x = [1];
        let c_x = [0];
        let d_x = [ddp0.x]
        let d_y = [ddp0.y]
        a_x[this.pointsCtr.length-1] = 0;
        b_x[this.pointsCtr.length-1] = 1;
        c_x[this.pointsCtr.length-1] = 0;
        d_x[this.pointsCtr.length-1] = ddpn.x
        d_y[this.pointsCtr.length-1] = ddpn.y

        let a_y = [0];
        let b_y = [1];
        let c_y = [0];
        a_y[this.pointsCtr.length-1] = 0;
        b_y[this.pointsCtr.length-1] = 1;
        c_y[this.pointsCtr.length-1] = 0;

        for (j = 1; j < this.pointsCtr.length-1; j++) {
            console.log(j)
            c_x[j] = this.pointsCtr[j].t - this.pointsCtr[j-1].t
            a_x[j] = this.pointsCtr[j+1].t - this.pointsCtr[j].t
            b_x[j] = 2*(a_x[j] + c_x[j])
            d_x[j] = 6 * ((this.pointsCtr[j+1].x - this.pointsCtr[j].x) / (this.pointsCtr[j+1].t - this.pointsCtr[j].t) - 
                (this.pointsCtr[j].x - this.pointsCtr[j-1].x) / (this.pointsCtr[j].t - this.pointsCtr[j-1].t))
        }

        for (j = 1; j < this.pointsCtr.length-1; j++) {
            console.log(j)
            c_y[j] = this.pointsCtr[j].t - this.pointsCtr[j-1].t
            a_y[j] = this.pointsCtr[j+1].t - this.pointsCtr[j].t
            b_y[j] = 2*(a_y[j] + c_y[j])
            d_y[j] = 6 * ((this.pointsCtr[j+1].y - this.pointsCtr[j].y) / (this.pointsCtr[j+1].t - this.pointsCtr[j].t) - 
                (this.pointsCtr[j].y - this.pointsCtr[j-1].y) / (this.pointsCtr[j].t - this.pointsCtr[j-1].t))
        }

        for (j = 1; j < this.pointsCtr.length; j++) {
            console.log(j)
            c_x[j] = c_x[j] / (b_x[j] - c_x[j-1]*a_x[j])
            d_x[j] = (d_x[j] - d_x[j-1]*a_x[j]) / (b_x[j] - c_x[j-1]*a_x[j])
        }     

        for (j = 1; j < this.pointsCtr.length; j++) {
            console.log(j)
            c_y[j] = c_y[j] / (b_y[j] - c_y[j-1]*a_y[j])
            d_y[j] = (d_y[j] - d_y[j-1]*a_y[j]) / (b_y[j] - c_y[j-1]*a_y[j])
        }  
          
        console.log(a_x, d_x)
  
        let M_x = []
        let M_y = []
        M_x[this.pointsCtr.length - 1] = d_x[this.pointsCtr.length - 1];
        M_y[this.pointsCtr.length - 1] = d_y[this.pointsCtr.length - 1]; 

        for (j = this.pointsCtr.length - 2; j >= 0; j--) {
           M_x[j] = d_x[j] - c_x[j] *  M_x[j+1]
        }    

        for (j = this.pointsCtr.length - 2; j >= 0; j--) {
           M_y[j] = d_y[j] - c_y[j] *  M_y[j+1]
        }    

		for (j = 0; j < N; j++) {
			h = this.pointsCtr[i+1].t - this.pointsCtr[i].t
	        x = M_x[i] * Math.pow((this.pointsCtr[i+1].t - t), 3) / (6*h) + M_x[i+1] * Math.pow((t - this.pointsCtr[i].t), 3) / (6*h) + 
	           (this.pointsCtr[i].x - M_x[i] * h * h / 6) * (this.pointsCtr[i+1].t - t) / h + (this.pointsCtr[i+1].x - M_x[i+1] * h * h / 6) * (t - this.pointsCtr[i].t) / h
	        y = M_y[i] * Math.pow((this.pointsCtr[i+1].t - t), 3) / (6*h) + M_y[i+1] * Math.pow((t - this.pointsCtr[i].t), 3) / (6*h) + 
	            (this.pointsCtr[i].y - M_y[i] * h * h / 6) * (this.pointsCtr[i+1].t - t) / h + (this.pointsCtr[i+1].y - M_y[i+1] * h * h / 6) * (t - this.pointsCtr[i].t) / h
			pt = new Point(x, y);
			this.pointsSpline[j]=pt;
			t += dt;
			while ((t > this.pointsCtr[i+1].t) && (i < this.pointsCtr.length - 2))
				i++;
		}


		console.log(this.pointsSpline)
        this.verticesSpline = new Float32Array(this.pointsSpline.length * 2);
        for (j = 0; j < this.pointsSpline.length; j++) {
            this.verticesSpline[j * 2] = this.pointsSpline[j].x;
            this.verticesSpline[j * 2 + 1] = this.pointsSpline[j].y;
		}
        
    }
}

function click(ev, canvas) {
    const x = ev.clientX; // x coordinate of a mouse pointer
    const y = ev.clientY; // y coordinate of a mouse pointer
    const rect = ev.target.getBoundingClientRect();

    Data.clickHandler(x - rect.left, canvas.height - (y - rect.top));
}

function mousedown(ev, canvas) {
    const x = ev.clientX; // x coordinate of a mouse pointer
    const y = ev.clientY; // y coordinate of a mouse pointer
    const rect = ev.target.getBoundingClientRect();

    Data.mousedownHandler(EventUtil.getButton(ev), x - rect.left, canvas.height - (y - rect.top));
}

function mouseup(ev, canvas) {
    const x = ev.clientX; // x coordinate of a mouse pointer
    const y = ev.clientY; // y coordinate of a mouse pointer
    const rect = ev.target.getBoundingClientRect();

    Data.mouseupHandler(EventUtil.getButton(ev), x - rect.left, canvas.height - (y - rect.top));
}

function mousemove(ev, canvas) {
    const x = ev.clientX; // x coordinate of a mouse pointer
    const y = ev.clientY; // y coordinate of a mouse pointer
    const rect = ev.target.getBoundingClientRect();
    //if (ev.buttons == 1)
    //    alert('with left key');
    Data.mousemoveHandler(x - rect.left, canvas.height - (y - rect.top));
}
