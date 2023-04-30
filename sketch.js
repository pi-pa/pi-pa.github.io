let sinks = [];
let allpoints = [] ;
let noiseScale = .001;
let noiseTime = .01;
let zoom = 40;
let depth;
let view;
let prehovered, hovered;
// let font;
let touchPos;
let isMouseOverCanvas = false;
let capturedText = "";
const maxPointsShown = 30;
let startSequence = false;

function preload() {
    asterion =  loadJSON('zuest/embeddings.json');
    centers = loadJSON('zuest/clusters.json');
    space = loadJSON('zuest/extreme_values.json');
    books = loadJSON('zuest/embeddings_books.json');
    shelves = loadJSON('zuest/embeddings_cat.json');
    reads = loadJSON('zuest/embeddings_read.json')
    // font = loadFont('assets/Minimal-Mono-Regular.otf');
}

function setup() {
    cnv = createCanvas(windowWidth*.4, windowHeight);
    textFont('Courier New');
    angleMode(DEGREES);
    colorMode(HSB, 360, 100, 100, 100);
    frameRate(24);

    // DEFINE INTERACTIONS WITH CANVAS
    cnv.mouseOver(mouseOverCanvas);
    cnv.mouseOut(mouseOutCanvas);

    // CREATE VECTORS WITH STRINGS FOR EACH POINT IN EMBEDDING (MAPPED TO THE 1000PX SPACE)
    clusters = Object.values(centers).map( a => {
        return {anchor: createVector(...a.c.map( (d, i) => map(d,space.min[i],space.max[i],0,1000)))}
        });
    books = Object.values(books).map( a => {
        return {
            anchor: createVector(...a.e.map( (d, i) => map(d,space.min[i],space.max[i],0,1000))),
            t: a.t, //TITLE
            s: a.s, //SIGNATUR
            p: createVector(random(),random()).mult(2000),
            }
        });
    reads = Object.values(reads).map( a => {
        return {
            anchor: createVector(...a.e.map( (d, i) => map(d,space.min[i],space.max[i],0,1000))),
            t: a.t, //TITLE
            a: a.a //AUTHOR
            }
        });

    categories = [];
    Object.values(shelves).forEach( shelf => {
        shelf.sc.forEach( c => categories.push({
            str: c.c,
            anchor: createVector(...c.e.map( (d, i) => map(d,space.min[i],space.max[i],0,1000)))
        }))
    })
    
    shelves = Object.values(shelves).map( a => {
        return {
            anchor: createVector(...a.e.map( (d, i) => map(d,space.min[i],space.max[i],0,1000))),
            c: a.c,
            }
    });

    // [books, reads, categories, shelves].forEach( a => a.forEach( thing => {
    //     thing.angle = getSpaceAngle(thing.anchor, clusters);
    // }))
    
    // CREATE VECTORS WITH STRINGS FOR EACH POINT IN EMBEDDING (MAPPED TO THE 1000PX SPACE)
    asterion = Object.values(asterion);
    for (let x = 0; x < asterion.length; x++) {
        for (let y = 0; y < asterion[x].a.length; y++) allpoints.push({
            anchor: createVector(...asterion[x].e[y].map( (a,i) => map(a,space.min[i],space.max[i],0,1000))),
            str: asterion[x].a[y],
            prompt: asterion[x].p,
            status: -1,
            timer: -1,
            neighbors: asterion[x]["ms"][y],
            id: [asterion[x].i, y]
        })
    } 
    // CREATE VIEW
    view = {
        pos: createVector(1000,500),
        r: 2000,
        getP: function( v ) {
            return [
                map(v.x, this.pos.x-this.r, this.pos.x+view.r, 0, height),
                map(v.y, this.pos.y-this.r, this.pos.y+this.r, 0, height)
            ]
        }
    }
    //CREATE HUV LAYER
    huvLayer = createGraphics(width,height);
    huvLayer.colorMode(HSB, 360, 100, 100, 100);
    // INITIALIZE SOME STRINGS
    allpoints.forEach( a => random()<.1? a.status=0:0);
    console.log(categories);
}

function draw() {
    clear();
    noCursor()
    // START SEQUENCE
    if (startSequence) view.r += PI
    if (view.r > 600) startSequence = false;
    // if (view.r < 0) {
        push(),  noStroke();
        // radialGradient(
        //     width/2,height/2, 0,//Start pX, pY, start circle radius
        //     width/2,height/2, 100,//End pX, pY, End circle radius
        //     color(255), //Start color
        //     color(255), //End color
        // );
        textSize(10000/pow(view.r,.5)), textAlign(CENTER), fill(200);
        // text("       An AI Reading of the Library of Andreas Züst",width/2,height/2+2500/view.r);
        pop();
    // }

    // STOP CAMERA AT BORDERS
    ['x','y'].forEach( d => view.pos[d] = constrain(view.pos[d], 0 ,1000));
    
    // DEFINE ZOOM LEVEL WITH VIEW RADIUS
    zoom = 1000/view.r*14*.3;

    // UPDATE TIMER IN DATA
    allpoints.filter(a => a.status !== a.timer).forEach( a => {
        a.timer += (a.status-a.timer)/10;
        if (a.timer > .98) a.timer = 1;
    });

    // RETRIEVE DATA
    let points = allpoints.filter( a => a.timer > -1 && a.timer < 1 && ['x','y'].every( d=> abs(view.pos[d]-a.anchor[d]) < view.r ));
    let bookpoints = books.filter( a => ['x','y'].every( d=> abs(view.pos[d]-a.anchor[d]) < view.r ));
    let readpoints = reads.filter( a => ['x','y'].every( d=> abs(view.pos[d]-a.anchor[d]) < view.r ));
    let cats = shelves.filter( a => ['x','y'].every( d=> abs(view.pos[d]-a.anchor[d]) < view.r ));
    let subcats = categories.filter( a => ['x','y'].every( d=> abs(view.pos[d]-a.anchor[d]) < view.r ));
    let sinks = clusters//.filter( a => ['z'].every( d=> abs(view.pos[d]-a.anchor[d]) < view.r ));
    
    // VISUALIZE CURSOS WITH SINKS
    let cursorSize = 15;
    let cursorColor = hovered? 'white': 'black';
    if (!startSequence) {
        push(), translate(mouseX,mouseY), rotate(getSpaceAngle(createVector(mouseX,mouseY), clusters));
        stroke(cursorColor), noFill(), strokeWeight(1);
        ellipse(0,0,cursorSize*2), line(0,-cursorSize,0,cursorSize), line(-cursorSize,0,cursorSize,0);
        pop();
    }

    // SINKHOLE CONSTELLATION LINES AND STARS
    sinks.forEach( (s, j) => {
        push(),  noStroke();
        radialGradient(
            ...view.getP(s.anchor), 0,//Start pX, pY, start circle radius
            ...view.getP(s.anchor), 10,//End pX, pY, End circle radius
            color(200), //Start color
            color(200,0), //End color
        );
        ellipse(...view.getP(s.anchor), 20);
        pop();
        sinks.filter( (s2, k) => k < j ).forEach( s2 => {
            strokeWeight(.1), stroke(200);
            line( ...view.getP(s.anchor), ...view.getP(s2.anchor));
        })
    })

    // SCREENSAVER
    // if (view.r < 0) {
    //     books.forEach( a => {
    //     noStroke(), fill(255,10);
    //     let anglePerlin = map(noise(a.p.x*noiseScale, a.p.y*noiseScale, frameCount*noiseTime*.05), 0, 1, 0, 360);
    //     let angle = anglePerlin*10+getSpaceAngle(a.p, clusters);
    //     a.p.add(createVector(cos(angle),sin(angle)).mult(5*.8))
    //     push(),  noStroke();
    //     radialGradient(
    //         ...view.getP(a.p), 0,//Start pX, pY, start circle radius
    //         ...view.getP(a.p), a.t.length*2,//End pX, pY, End circle radius
    //         color(20), //Start color
    //         color(250,20), //End color
    //     );
    //     ellipse(...view.getP(a.p), a.t.length);
    //     pop();
         
    //     })
    //  }

    

    // POINT WISE VISUALIZATIONS
    bookpoints.forEach( a => {
        // push(),  translate(...view.getP(a.anchor)), //rotate(a.angle);
        noStroke(), fill(65), textSize(zoom/4), textAlign(CENTER);
        text(a.t, ...view.getP(a.anchor));
    });

    readpoints.forEach( a => {
        // push(),  translate(...view.getP(a.anchor)), //rotate(a.angle);
        noStroke(), fill(25), textSize(zoom/4), textAlign(CENTER);
        text(a.t, ...view.getP(a.anchor));
    });

    cats.forEach( a => {
        noStroke(), fill(70), textSize(zoom), textAlign(CENTER);
        text(a.c, ...view.getP(a.anchor));
    });

    subcats.forEach( a => {
        noStroke(), fill(60), textSize(zoom/2), textAlign(CENTER);
        text(a.str, ...view.getP(a.anchor));
    });

    // CALCULATE POSITIONS BY APPLYING FORCES
    // NOTE: non-derivable curve issues appear when weighting angleSink and around the 360->0 step
    if (!prehovered) hovered = null;
    if (prehovered) hovered = prehovered, prehovered = null;
    for (let x = 0; x < min(points.length, maxPointsShown); x++) {
        points[x].p = points[x].anchor.copy();
        let a = points[x];
        // let words = str.split(' ');
        for (let index=0; index < a.str.length && index < (a.status==0?100*(a.timer+1):100-a.timer*100); index++) {
            let anglePerlin = map(noise(a.p.x*noiseScale, a.p.y*noiseScale, frameCount*noiseTime*.05), 0, 1, 0, 360);
            let angle = getSpaceAngle(a.p, sinks)//+anglePerlin;

            let spaceScale = sinks.reduce( (agg, s) => {
                let d =  dist(a.p.x,a.p.y,s.anchor.x,s.anchor.y);
                if (d < agg) return d;
                else return agg;
            }, 100)/80;
            if (spaceScale < .06) break;
            let scaleVector = createVector(cos(angle),sin(angle)).mult(5*spaceScale)//*(words[index-1]?words[index-1].length+1:0));

            a.p.add(scaleVector);
            // if (sinks.some(s => dist(a.p.x,a.p.y,s.anchor.x,s.anchor.y) < 30)) break;

            let viewP = ['x','y'].map( d => map(a.p[d],view.pos[d]-view.r,view.pos[d]+view.r,0,height));
            // HOVER INTERACTION
            if (dist(mouseX, mouseY, viewP[0], viewP[1]) < zoom/2) prehovered = a; 
            // if (hovered === a) visualizeText(hovered);

            // DRAW EACH CHARACTER FROM THE LINE
            // NOTE : to radically improve performance, draw words instead of characters and chain small words
            // NOTE: camera is using height to project both xy dimensions 
            // IDEA: use font size to represent focus distance or when near to center of gravity
            push(), translate(...viewP), rotate(angle);
            noStroke(), fill((a.timer+1)*255);
            if (hovered === a) strokeWeight(1), stroke(300,0,100,100); 
            textAlign(CENTER), textSize(zoom*spaceScale);
            let char = a.str[index];
            // if (spaceScale > .2 && zoom > 10 ) 
            text(char,0,6);
            // else strokeWeight(spaceScale*zoom/2), stroke(90), index%2==0?point(0,6):0;
            pop();
        }
    }
    // Hide again those that were not allowed to show by the maxPoints limit
    for (let x = maxPointsShown; x < points.length; x++) {
        points[x].status = -1;
        points[x].timer = -1;
    }
    // drawingContext.filter = 'blur(8px)';
    // ISOCUBE
    // drawIsomap(width-100,70,50);

    // drawHUV();
    mouseIsDragged = false;
}

// TODO FIX SELECTION INTERACTION
function mouseClicked () {
    if (hovered && !mouseIsDragged) {
        let promptid = hovered.id[0];
        let allanswers = allpoints.filter(a => a.id[0] === promptid);
        allanswers.forEach( a => a.status = 1);
        let answer = allanswers.sort( (a,b) => a.id[1] < b.id[1]).reduce( (agg, a) => agg+="<p>"+a.str+"</p>", "");
        updateTextBox("Prompt #"+promptid +": "+hovered.prompt, answer);
        hovered.status = 1;
        hovered.neighbors.forEach( a => {
            let neighbor = allpoints.find( b => a[0] == b.id[0] && a[1] == b.id[1]);
            if (neighbor.status == -1) neighbor.status = 0;
        });
    }
}

// INTERACTIVE MOVEMENT
function mouseWheel(event) {
    // if (isMouseOverCanvas) view.pos.add( createVector(0, 0, event.delta) );
    if (isMouseOverCanvas) view.r += (event.delta);
}

function mouseDragged() {
    mouseIsDragged = true;
    let dx = mouseX - pmouseX;
    let dy = mouseY - pmouseY;
    if (isMouseOverCanvas) dragVector = view.pos.add(createVector(-dx, -dy, 0));
}

function mouseOverCanvas() {
  isMouseOverCanvas = true;
}

function mouseOutCanvas() {
  isMouseOverCanvas = false;
}

function updateTextBox(prompt, answer) {
    const textBox = document.getElementById('text-box');
    capturedText += "<p><b>"+prompt+"</b><p>"+answer+"</p>";
    textBox.innerHTML = capturedText;
    textBox.scrollTop = textBox.scrollHeight;
}

function radialGradient(sX, sY, sR, eX, eY, eR, colorS, colorE){
    let gradient = drawingContext.createRadialGradient(
      sX, sY, sR, eX, eY, eR
    );
    gradient.addColorStop(0, colorS);
    gradient.addColorStop(1, colorE);
  
    drawingContext.fillStyle = gradient;
    // drawingContext.strokeStyle = gradient;
}

function getSpaceAngle( v, sinks ) {
    let angle = 0;
    sinks.forEach( s => {
        let l1 = v.y - s.anchor.y;
        let l2 = v.x - s.anchor.x;
        let angleSink = atan(l1 / l2); // (-90,90) when in DEGREES 
        if (l2 < 0) angleSink = atan(l1 / l2)+180*3;
        angle += 360+angleSink;
    });
    return angle;
}

// function drawHUV() {
//     huvLayer.background(20), huvLayer.noStroke();
//     // huvLayer.rect(0,0,width,height);
//     huvLayer.stroke(255), huvLayer.strokeWeight(4), huvLayer.fill(0);
//     huvLayer.ellipse(width/2,height/2,width*.9);
//     huvLayer.erase();
//     // huvLayer.stroke(255), huvLayer.noFill();
//     huvLayer.ellipse(width/2,height/2,width*.9);
//     huvLayer.noErase();
     
//     image(huvLayer,0,0);
//     // beginShape();
//     // curveVertex(width*2,height/2);
//     // curveVertex(width,height/2);
//     // curveVertex(width/2,height/4);
//     // curveVertex(0,height/2);
//     // curveVertex(-width,height/2);
//     // endShape();
// }