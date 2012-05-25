var CACHE_DIR = '/cache';

function initAudience(socket, broadcast_id, ratio) {
    var mode, canvas, video, slide;
    var cacheDir = CACHE_DIR + '/' + broadcast_id;

    var width, height;
    ratio = ratio.split(':');
    ratio = parseInt(ratio[0]) / parseInt(ratio[1]);

    var $$canvas = $('#canvas'),
        $$drawing = $('#drawing'),
        $$graphics = $('#graphics'),
        $$video = $('#video'),
        $$slide = $('#slide');
    var $canvas = $$canvas[0],
        $drawing = $$drawing[0],
        $graphics = $$graphics[0],
        $video = $$video[0],
        $slide = $$slide[0];
    var ctxGraphics = $graphics.getContext('2d'),
        ctxDrawing = $drawing.getContext('2d');
    var slideControl;

    // initialize audience
    socket.once('initialize', function (data) {
        mode = data.mode;
        canvas = data.canvas;
        video = data.video;
        slide = data.slide;

        // resize components and redraw canvases
        window.onresize();
        
        // initialize mode
        switch (mode) {
            case 'white':
                $$canvas.show();
                break;
            case 'video':
                initVideo();
                $$video.show();
                break;
            case 'slide':
                initSlide();
                $$canvas.show();
                $$slide.show();
                break;
            default:
                // XXX Error!!!
        }
    });

    // on window resize event
    window.onresize = function () {
        // get current size
        width = window.innerWidth;
        height = window.innerHeight;
        if (width == 0 || height == 0)
            return;
        // set video size
        $video.width = width;
        $video.height = height;
        // compute size
        var curRatio = width / height;
        if (curRatio > ratio)
            width *= ratio / curRatio;
        else if (curRatio < ratio)
            height *= curRatio / ratio;
        // resize canvases and slide
        function setPos(e) {
            e.width = width;
            e.height = height;
            e.style.left = (window.innerWidth - width) / 2;
            e.style.top = (window.innerHeight - height) / 2;
        }
        setPos($drawing);
        setPos($graphics);
        setPos($slide);
        
        // redraw
        redrawGraphics();
        redrawDrawing();
    };

    // drawing functions
    function redrawGraphics() {
        var ctx = ctxGraphics;
        ctx.clearRect(0, 0, width, height);
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        for (var i = canvas.graphics.length - 1; i >= 0; --i) {
            var graph = canvas.graphics[i];
            if (graph.type === 'clear')
                break;
            else if (graph.type === 'path')
                drawPath(ctx, graph);
        }
        ctx.restore();
    }
    function redrawDrawing() {
        ctxDrawing.clearRect(0, 0, width, height);
        if (!canvas.drawing)
            return;
        drawPath(ctxDrawing, canvas.drawing);
    }
    function drawPath(ctx, graph) {
        var path = graph.points;
        if (path.length <= 1)
            return;

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineWidth = graph.width;
        ctx.strokeStyle = graph.color;

        ctx.beginPath();
        ctx.moveTo(path[0].x * width, path[0].y * height);
        // TODO using bezier smooth
        for (var i = 1; i < path.length; ++i)
            ctx.lineTo(path[i].x * width, path[i].y * height);
        ctx.stroke();

        ctx.restore();
    }

    // other mode change
    function initVideo() {
        $$video.empty();
        $('<source>').attr('src', cacheDir + '/file-' + video.fileid)
                     .attr('type', 'video/mp4') // XXX support more type
                     .appendTo($video);
        $video.currentTime = video.position;
        if (video.status === 'playing')
            $video.play();
        else
            $video.pause();
    }
    function initSlide() {
        $slide.src = cacheDir + '/slide-' + slide.slideid + '/';
        $$slide.one('load', function () {
            slideControl = $slide.contentWindow.slideControl;
            if (slide.step)
                slideControl.go(slide.step);
        });
    }

    /* Events */

    // Draw path
    socket.on('draw path', function (x, y, color, width) {
        canvas.drawing = {
            type: 'path',
            color: color,
            width: width,
            points: [{x: x, y: y}]
        };
    });
    socket.on('draw path add', function (x, y) {
        var drawing = canvas.drawing;
        if (drawing && drawing.type !== 'path') {
            drawing.points.push({x: x, y: y});
            // redraw
            redrawDrawing();
        }
    });
    socket.on('draw path end', function (x, y) {
        var drawing = canvas.drawing;
        if (drawing && drawing.type === 'path') {
            drawing.points.push({x: x, y: y});
            canvas.graphics.push(drawing);
            drawPath(ctxGraphics, drawing);
            canvas.drawing = null;
            canvas.history = [];
            redrawDrawing();
        }
    });
    // Drawing control
    socket.on('draw clear', function () {
        canvas.graphics.push({type: 'clear'});
        redrawGraphics();
    });
    socket.on('draw undo', function () {
        if (canvas.graphics.length > 0) {
            canvas.history.push(canvas.graphics.pop());
            redrawGraphics();
        }
    });
    socket.onEvent('draw redo', function () {
        if (canvas.history.length > 0) {
            var graph = canvas.history.pop();
            canvas.graphics.push(graph);
            drawPath(ctxGraphics, graph);
        }
    });

    // White mode
    socket.on('mode white', function () {
        broadcast.mode = 'white';
        // clean
        canvas.graphics = [];
        canvas.history = [];
        redrawGraphics();
        redrawDrawing();
        // display
        $$canvas.show();
        $$video.hide();
        $$slide.hide();
    });

    // Video mode
    socket.on('mode video', function (fileid) {
        broadcast.mode = 'video';
        video.fileid = fileid;
        video.status = 'paused';
        video.position = 0;
        initVideo();
    });
    socket.on('video play', function (pos) {
        video.status = 'playing';
        $video.currentTime = video.position = pos;
        $video.play();
    });
    socket.on('video pause', function (pos) {
        video.status = 'paused';
        video.position = pos;
        if ($video.currentTime >= pos) {
            $video.pause();
        }
        else {
            $$video.on('timeupdate', function () {
                if ($video.currentTime >= pos) {
                    $video.pause();
                    $$video.off('timeupdate');
                }
            });
        }
    });
    socket.on('video seek', function (pos) {
        $video.currentTime = video.position = pos;
    });

    // Slide mode
    socket.on('mode slide', function (slideid) {
        slide.slideid = slideid;
        slide.step = null;
        initSlide();

        // clean canvas
        broadcast.mode = 'slide';
        canvas.graphics = [];
        canvas.history = [];
        canvas.drawing = null;
        redrawGraphics();
        redrawDrawing();
    });
    socket.on('slide step', function (step, pagechanged) {
        slide.step = step;
        if (pagechanged) {
            canvas.graphics = [];
            canvas.history = [];
            canvas.drawing = null;
            redrawGraphics();
            redrawDrawing();
        }
        slideControl.go(step);
    });

    // Host disconnected
    socket.on('host disconnected', function () {
        // reload page to exit
        window.location.reload();
    });

    // start joining
    socket.emit('join', broadcast_id);
}