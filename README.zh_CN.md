# White——基于 Web 的广播白板系统

## 简介

White 的主要功能是，完全基于网页地，将一台终端上进行的绘图、视频播放、幻灯片放映等操作，实时地广播到其他的终端上，以实现一个功能较为全面的跨平台的一对多的电子白板系统。

## 设计思路

White 的基本设计思路是，一个终端进入系统后可以创建一个新的广播，广播创建后其他访问这个页面的访问者可以选择加入已有的某个广播或创建另一个新的广播。

整套系统分为3个部分：

1. **主机 (host)** 又称主持人，是广播的发起者，白板的所有操作都由主机进行；
2. **服务器 (server)** White 的服务器，负责保存主机上传的视频、幻灯片等文件，并将主机的操作转发给其他终端；
3. **听众 (audience)** 通过服务器接收主机的操作，并实时地反应在页面当中。

在同一个广播中的三个部分根据主机操作者的操作，各自维护白板的当前状态。

White 有三个工作模式：

1. **白板模式 (white)** 这个模式下屏幕显示为一张白板，主机操作者可以使用绘图工具在上面进行绘制；
2. **视频模式 (video)** 此模式用于播放视频，主机可以上传或选择已有视频并进行广播播放，同时可以任意地控制视频的播放、暂停和定位；
3. **幻灯片模式 (slide)** 此模式用于广播放映基于 HTML 的幻灯片，主机可以上传或选择已有的幻灯片文件包来广播放映幻灯片，控制幻灯片的页数，并可以在幻灯片上绘制注解。

## 实现技术

White 在服务器端使用了 Node.js 结合 express 框架和 connect 中间件处理 HTTP 请求，服务器端与浏览器页面之间的通讯使用 WebSocket，实现上使用了 Node.js 的库 Socket.io。

浏览器方面，白板模式和幻灯片模式下的绘图使用了 HTML5 的 `canvas` 标签以提供动态绘图接口；视频模式使用了 HTML5 的 `video` 标签进行视频播放和控制。

在视频播放的方面，由于视频文件通常较大，为了可以在上传时同步播放，我们自己开发了流缓冲的模块，以支持跨请求一对多的边上传边下载技术。

## 实现细节

### 功能

为了在不同终端上尽量保持一致性，并在此基础上尽量保证体验的最优化，建立广播时需要先指定广播区域的比例，默认提供了 4:3、16:9、16:10 及 3:2 几种。在绘图时，图中点的位置和线条粗细在传输的过程中都是一个比例数值，在绘制时会乘上实际的长宽以实现即保持一致，又有较好的显示效果。

在视频播放时，由于控制视频跳跃的操作无法直接被捕捉，`video` 标签仅提供了 `timeupdate` 这一事件，而这一事件无论在播放过程中还是跳跃过程中都会被触发，因此在每次出发时会自动记录触发的系统时间，每次触发时会对比当前系统时间和上次触发的系统时间以及当前播放进度和上次触发时播放进度之间的差异，当差异过大时才触发一次广播的视频跳跃。

服务器端由于无法实时获知主机的播放进度，因此除了保存上次视频跳跃到的播放位置以外，还记录了当时的系统时间，在新的听众加入时，如果视频处在播放状态，则将上次播放位置加上系统时间差再反馈给听众，使得听众开始时也能尽量与主机保持同步。

幻灯片方面，为了捕获幻灯片的切换操作以及控制幻灯片，系统需要幻灯片在顶层 `window` 对象中实现 `slideControl` 对象，这个对象需要包含 `next()`、`prev()` 和 `go(step)` 三个对幻灯片的控制函数，以及 `stepchange(callback)` 和 `unbind(callback)` 这两个事件控制函数。在幻灯片发生切换时，通过调用使用 `stepchange` 函数注册的回调函数通知系统幻灯片发生切换，回调函数的参数为 `callback(step, pagechanged)`。在整个过程中，`step` 必须是一一对应于某一幻灯片的，并且其应当是可直接 JSON 化的，而 `pagechanged` 则为一个布尔值，表示本次切换是幻灯片切换或仅仅是片内动画。

上面提到的可以提供边上传边下载的流缓冲模块，基本思路是在上传过程中将数据保存到一个文件内，如果有下载者则先将文件内的数据读出发送，当下载者的进度赶上已上传的部分时将下载者加入等待队列，一旦有新数据上传上来即优先发送给等待中的下载者，再继续保存到文件。事实上由于在实现中使用了异步写的机制，在上传流写入文件后并不能假定这一部分数据已经可以从文件内读取，而必须保留这些数据在内存中直到数据已经被确认写回文件。而由于上传速度有时可以大大超过文件写回速度 (对于本地回环和千兆以上网络是很正常的)，为了防止在内存中缓存过多数据，还必须限制缓存的大小以防止内存占用过大导致的性能问题。

### 界面

听众界面较为简单，仅仅是主机界面的一部分，基本没有界面设计的元素。

主机界面上画笔颜色和粗细选择器是通过代码动态生成的，其中颜色选择器的按钮图标上的调色板可以根据选择的颜色不同变化，而颜色选择器内的颜色呈现斜椭圆的形状，这些是通过 CSS3 的 `border-radius` 和 `transform` 实现的。

## 计划中的功能

由于开发时间较短，最初设计中的部分功能未有完全实现，在之后的开发过程中也又提出了一些新的功能的想法，这些功能的实现目前仍在计划中：

1. **上传** 虽然设计中视频和幻灯片都可以由主机在使用时上传，但目前仅仅在服务器端实现了上传，浏览器端仅设计了相应界面但尚未实现对应的功能；
2. **文字和图片** 最初的设想中在白板模式和幻灯片模式下除了可以使用画笔绘图外还可以添加文字和自定义的图片，但由于设计上还需要更多的考虑，因此尚未实现；
3. **多白板** 原本计划中支持不止一个白板，并可以在白板之间随意切换，在没有人为清理的情况下不会清楚任何白板内容，由于实现复杂，该功能在开发过程中被去掉；
4. **显示听众数** 计划中主机可以实时看到当前的听众数量，这一点在服务器端已经完成但由于界面设计局限性，尚未被加入到浏览器端；
5. **曲线平滑化** 为了防止由于两个采样点之间距离过大导致的曲线不平滑，应该应用一定的曲线平滑化算法，事实上我们已经设计了一种平滑算法，但尚未应用于本系统；
6. **视频音量调节** 广播音量调节在理论上是可行的，但也暂时未在系统中实现；
7. **视频标注** 即在播放视频的过程中像播放幻灯片时一样可以进行标注；
8. **多点绘图** 在支持多点触控的终端上支持多个手指同时绘图；
9. **保存记录** 在需要的情况下，服务器端可以保存并重现整个广播过程。

## 局限性

由于技术上和实现上的限制，本系统尚有一些局限性：

1. **视频格式限制** 目前 White 仅设计支持 video/mp4 格式的视频，并将其硬编码到代码中，对于不支持 mp4 格式的浏览器，将无法播放视频；
2. **幻灯片限制** 由于跨浏览器的排版和渲染问题，并非所有的 HTML 幻灯片框架都能很好地支持，事实上所有的幻灯片框架都必须经过适当的调整才能在本系统中使用，系统希望幻灯片自己能在不同的长宽下保持内容的等比例缩放，以保证在幻灯片上进行的绘图操作可以在听众的屏幕上与主机保持一直；
3. **幻灯片包格式** 目前仅支持 .zip 的幻灯片压缩包，并且要求包内要有 index.html 文件位于根目录下；
4. **iPad 下的视频** 由于 iOS 中的 Safari Mobile 浏览器对 `video` 的实现限制，在 iPad 下使用本系统还有额外的问题：
	1. 由于 iOS 中如果用户不点击视频则视频不能进行缓冲或播放，因此 iPad 无法作为听众端接收视频广播；
	2. 由于 iPad 中位于视频元素上方的任何元素无法被点击，因此在视频模式下无法切换视频或进入幻灯片模式，要进行上述操作必须先切换回白板模式。
5. **样式未全 CSS 化** 主机界面还未能完全 CSS 化，很多部件的定位是由脚本程序完成的，这使得改变窗口大小时会有一定的性能减损。