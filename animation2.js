import * as THREE from 'https://unpkg.com/three@0.118.1/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.118.1/examples/jsm/controls/OrbitControls';
import Gui from "https://cdn.skypack.dev/@malven/gui@1.6.0";

window.APP = {};

APP.gui = new Gui({ midi: false });

new Animation();

/**
 * Controls animation
 *
 * @class    Animation
 * @param    {Object}  options  Options for the object
 * @return   {Object}  The object
 */
function Animation(options) {
    //
    //   Public Var
    //
    //////////////////////////////////////////////////////////////////////

    let self = Object.assign({}, {
        renderEl: document.querySelector('.js-animation-container'),
    }, options);

    let settings = {
        bgColor: 0x55fff5,
        cameraDistance: 14,
        timeInc: 0.30,
        pointSize: 0.700,
        gridSize: 250,
        gapSize: 0.07,
        xOscAmp: 0.5,
        xOscPeriod: 75,
        zOscAmp: 0.5,
        zOscPeriod: 75,
        noiseScale: 0.0001,
        noiseScaleY: 2,
        noiseOffset: 0.0003,
        noiseSpeed: 10,
    };


    //
    //   Private Vars
    //
    //////////////////////////////////////////////////////////////////////

    let renderer, controls, camera, scene, geometry, particles, pointTexture, uniforms;

    let time = 0;

    let updateUniforms = () => {};

    //
    //   Private Methods
    //
    //////////////////////////////////////////////////////////////////////

    const _init = () => {
        _getPointTexture().then(() => {
            _createUniforms();
            _createGui();
            _setup();
            _addObjects();
            _addEventListeners();
            _update();
        });
    };

    const _getPointTexture = () => {
        return new Promise(res => {
            new THREE.TextureLoader().load('https://assets.codepen.io/66496/dot.png', (texture) => {
                pointTexture = texture;
                res();
            });
        });
    };

    const _createUniforms = () => {
        // Uniforms
        uniforms = {
            pointTexture: { value: pointTexture },
        };
        updateUniforms = () => {
            Object.assign(uniforms, {}, {
                time: { value: time },
                pointSize: { value: settings.pointSize },
                gridSize: { value: settings.gridSize },
                gapSize: { value: settings.gapSize },
                xOscAmp: { value: settings.xOscAmp },
                xOscPeriod: { value: settings.xOscPeriod },
                zOscAmp: { value: settings.zOscAmp },
                zOscPeriod: { value: settings.zOscPeriod },
                noiseScale: { value: settings.noiseScale },
                noiseOffset: { value: settings.noiseOffset },
                noiseSpeed: { value: settings.noiseSpeed },
                noiseScaleY: { value: settings.noiseScaleY },
            });
        };
        updateUniforms();
    };

    const _createGui = () => {
        APP.gui.setFolder('time');
        APP.gui.add(settings, 'timeInc', 0.001, 2.000);
        APP.gui.setFolder('osc');
        APP.gui.add(settings, 'xOscAmp', 0.001, 3.000);
        APP.gui.add(settings, 'xOscPeriod', 4, 500);
        APP.gui.add(settings, 'zOscAmp', 0.001, 3.000);
        APP.gui.add(settings, 'zOscPeriod', 4, 500);
        APP.gui.addColor(settings, 'bgColor').onChange(_updateBg);
        APP.gui.setFolder('noise');
        APP.gui.add(settings, 'noiseScale', 0.00001, 0.0020);
        APP.gui.add(settings, 'noiseScaleY', 0.01, 10.0000);
        APP.gui.add(settings, 'noiseOffset', 0.0001, 0.0030);
        APP.gui.add(settings, 'noiseSpeed', 0.0001, 300.0000);
        APP.gui.setFolder('grid');
        APP.gui.add(settings, 'pointSize', 0.01, 7.000);
        APP.gui.add(settings, 'gridSize', 10, 1000).onChange(_addObjects);
        APP.gui.add(settings, 'gapSize', 0.005, 0.5);
    };

    const _setup = () => {
        // Renderer
        renderer = new THREE.WebGLRenderer({
            devicePixelRatio: settings.resolution,
            antialias: true,
        });
        renderer.setSize(self.renderEl.offsetWidth, self.renderEl.offsetHeight);
        self.renderEl.appendChild(renderer.domElement);

        // Camera
        camera = new THREE.PerspectiveCamera(45, self.renderEl.offsetWidth / self.renderEl.offsetHeight, 1, 10000);
        camera.position.set(-3, 0, settings.cameraDistance);
        scene = new THREE.Scene();
        _updateBg();

        // Orbit Controls
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableKeys = false;
        // controls.enablePan = false;
        controls.enableZoom = false;
        controls.enableDamping = false;
        // controls.enableRotate = false;

        // Resize the renderer on window resize
        window.addEventListener('resize', () => {
            camera.aspect = self.renderEl.offsetWidth / self.renderEl.offsetHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(self.renderEl.offsetWidth, self.renderEl.offsetHeight);
        }, true);
    };

    const _updateBg = () => {
        scene.background = new THREE.Color(settings.bgColor);
    };

    const _teardown = () => {
        if (particles) scene.remove(particles);
        if (geometry) geometry.dispose();
    };

    const _addObjects = () => {
        // Teardown
        _teardown();

        // Update uniforms
        // updateUniforms();
        // Create the geometry
        geometry = new THREE.BufferGeometry();

        let shaderMaterial = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: _getVertShader(),
            fragmentShader: _getFragShader(),
            // blending: THREE.AdditiveBlending,
            depthTest: false,
            transparent: true,
            vertexColors: true,
        });

        // Reset variables
        let positions = [];
        let sizes = [];
        let indexes = [];
        let lineIndexes = [];
        let offsets = [];

        for (var lineIdx = 0, length = settings.gridSize; lineIdx < length; lineIdx++) {
            for (let pointIdx = 0; pointIdx < settings.gridSize; pointIdx++) {
                positions.push(0);
                positions.push(0);
                positions.push(0);
                sizes.push(2);
                offsets.push(0);
                indexes.push(pointIdx);
                lineIndexes.push(lineIdx);
            }
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
        geometry.setAttribute('offset', new THREE.Float32BufferAttribute(offsets, 1).setUsage(THREE.DynamicDrawUsage));
        geometry.setAttribute('index', new THREE.Float32BufferAttribute(indexes, 1).setUsage(THREE.DynamicDrawUsage));
        geometry.setAttribute('lineIndex', new THREE.Float32BufferAttribute(lineIndexes, 1).setUsage(THREE.DynamicDrawUsage));
        particles = new THREE.Points(geometry, shaderMaterial);

        // Add particles to the scene
        scene.add(particles);

        // Example object
        // Only needed for debugging
        // let boxGeom = new THREE.BoxGeometry(1, 1, 1);
        // var material = new THREE.MeshPhongMaterial({
        //   color: 0x00ff00,
        //   specular: 0x00ff00,
        //   shininess: 30,
        // });
        // let boxMesh = new THREE.Mesh(boxGeom, material);
        // scene.add(boxMesh);

        // Light
        // let light = new THREE.DirectionalLight(0xffffff, 0.4);
        // light.position.set(5, 3, 2);
        // light.target.position.set(0, 0, 0);
        // scene.add(light);
    };

    const _addEventListeners = () => {

    };

    const _getVertShader = () => {
        return `
      #define M_PI 3.1415926535897932384626433832795

      attribute float size;
      attribute float offset;
      attribute float index;
      attribute float lineIndex;
      varying float vAlpha;
      varying float vStrength;

      uniform float time;
      uniform float noiseScale;
      uniform float noiseOffset;
      uniform float noiseSpeed;
      uniform float noiseScaleY;
      uniform float pointSize;
      uniform float gridSize;
      uniform float gapSize;
      uniform float xOscAmp;
      uniform float xOscPeriod;
      uniform float zOscAmp;
      uniform float zOscPeriod;

      /* https://www.shadertoy.com/view/XsX3zB
       *
       * The MIT License
       * Copyright © 2013 Nikita Miropolskiy
       *
       * ( license has been changed from CCA-NC-SA 3.0 to MIT
       *
       *   but thanks for attributing your source code when deriving from this sample
       *   with a following link: https://www.shadertoy.com/view/XsX3zB )
       *
       * ~
       * ~ if you're looking for procedural noise implementation examples you might
       * ~ also want to look at the following shaders:
       * ~
       * ~ Noise Lab shader by candycat: https://www.shadertoy.com/view/4sc3z2
       * ~
       * ~ Noise shaders by iq:
       * ~     Value    Noise 2D, Derivatives: https://www.shadertoy.com/view/4dXBRH
       * ~     Gradient Noise 2D, Derivatives: https://www.shadertoy.com/view/XdXBRH
       * ~     Value    Noise 3D, Derivatives: https://www.shadertoy.com/view/XsXfRH
       * ~     Gradient Noise 3D, Derivatives: https://www.shadertoy.com/view/4dffRH
       * ~     Value    Noise 2D             : https://www.shadertoy.com/view/lsf3WH
       * ~     Value    Noise 3D             : https://www.shadertoy.com/view/4sfGzS
       * ~     Gradient Noise 2D             : https://www.shadertoy.com/view/XdXGW8
       * ~     Gradient Noise 3D             : https://www.shadertoy.com/view/Xsl3Dl
       * ~     Simplex  Noise 2D             : https://www.shadertoy.com/view/Msf3WH
       * ~     Voronoise: https://www.shadertoy.com/view/Xd23Dh
       * ~
       *
       */

      /* discontinuous pseudorandom uniformly distributed in [-0.5, +0.5]^3 */
      vec3 random3(vec3 c) {
        float j = 4096.0*sin(dot(c,vec3(17.0, 59.4, 15.0)));
        vec3 r;
        r.z = fract(512.0*j);
        j *= .125;
        r.x = fract(512.0*j);
        j *= .125;
        r.y = fract(512.0*j);
        return r-0.5;
      }

      /* skew constants for 3d simplex functions */
      const float F3 =  0.3333333;
      const float G3 =  0.1666667;

      /* 3d simplex noise */
      float simplex3d(vec3 p) {
         /* 1. find current tetrahedron T and it's four vertices */
         /* s, s+i1, s+i2, s+1.0 - absolute skewed (integer) coordinates of T vertices */
         /* x, x1, x2, x3 - unskewed coordinates of p relative to each of T vertices*/

         /* calculate s and x */
         vec3 s = floor(p + dot(p, vec3(F3)));
         vec3 x = p - s + dot(s, vec3(G3));

         /* calculate i1 and i2 */
         vec3 e = step(vec3(0.0), x - x.yzx);
         vec3 i1 = e*(1.0 - e.zxy);
         vec3 i2 = 1.0 - e.zxy*(1.0 - e);

         /* x1, x2, x3 */
         vec3 x1 = x - i1 + G3;
         vec3 x2 = x - i2 + 2.0*G3;
         vec3 x3 = x - 1.0 + 3.0*G3;

         /* 2. find four surflets and store them in d */
         vec4 w, d;

         /* calculate surflet weights */
         w.x = dot(x, x);
         w.y = dot(x1, x1);
         w.z = dot(x2, x2);
         w.w = dot(x3, x3);

         /* w fades from 0.6 at the center of the surflet to 0.0 at the margin */
         w = max(0.6 - w, 0.0);

         /* calculate surflet components */
         d.x = dot(random3(s), x);
         d.y = dot(random3(s + i1), x1);
         d.z = dot(random3(s + i2), x2);
         d.w = dot(random3(s + 1.0), x3);

         /* multiply d by w^4 */
         w *= w;
         w *= w;
         d *= w;

         /* 3. return the sum of the four surflets */
         return dot(d, vec4(52.0));
      }

      float get_noise_value(vec2 p, float noiseIter, float scale) {
        vec3 p3 = vec3(p.x + noiseOffset*time, p.y + noiseOffset*time, noiseIter * 0.001);

        float value = simplex3d(p3*scale * 1000.0);

        value = 0.5 + 0.5 * value;

        return value;
      }

      void main() {
        float oscX = xOscAmp * sin((M_PI * 2.0) * ((index + time) / xOscPeriod));
        float oscZ = zOscAmp * cos((M_PI * 2.0) * ((lineIndex + time) / zOscPeriod));

        float totalSize = gapSize * gridSize;

        vec3 adjustedPosition = vec3(
          position.x - (totalSize * 0.5) + gapSize * index,
          position.y,
          position.z - (totalSize * 0.5) + lineIndex * gapSize
        );

        // Get noise
        float noiseValue = get_noise_value(adjustedPosition.xz, time * noiseSpeed, noiseScale);

        // Apply noise to y
        adjustedPosition.y += oscX + oscZ + noiseValue * noiseScaleY - (noiseScaleY / 2.0);

        vec4 mvPosition = modelViewMatrix * vec4(adjustedPosition, 1.0 );

        gl_PointSize = size * pointSize;

        // Get distance to center and use that to determine alpha
        vec3 centerVec = vec3(0.0, 0.0, 0.0);
        float centerDist = distance(centerVec, adjustedPosition);
        float centerDistAlpha = smoothstep(totalSize * 0.5, 0.0, centerDist);
        vAlpha = centerDistAlpha;

        vStrength = 1.0;

        gl_Position = projectionMatrix * mvPosition;
      } 
    `;
    };

    const _getFragShader = () => {
        return `
      uniform sampler2D pointTexture;
      varying float vAlpha;
      varying float vStrength;

      void main() {
        gl_FragColor = vec4(
          0.0,
          0.2,
          0.7,
          vAlpha * texture2D(pointTexture, gl_PointCoord).a
        );
      } 
    `;
    };

    const _updateCamera = () => {
        controls.update();
        camera.lookAt(scene.position);
    };

    const _update = () => {
        _updateTime();
        updateUniforms();
        _updateCamera();
        renderer.render(scene, camera);
        window.requestAnimationFrame(_update);
    };

    const _updateTime = () => {
        time = time + settings.timeInc;
    };


    //
    //   Initialize
    //
    //////////////////////////////////////////////////////////////////////

    _init();

    // Return the Object
    return self;
}
