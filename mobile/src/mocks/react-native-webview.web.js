import React, { useRef, useEffect } from 'react';
import { View } from 'react-native';

// Web stub: renders an <iframe> in place of the native WebView.
// Injects a ReactNativeWebView shim so postMessage calls from Leaflet
// are forwarded to the parent window, triggering onMessage correctly.
const WebView = React.forwardRef(({ source, style, onMessage, onLoad }, ref) => {
  const iframeRef = useRef(null);

  React.useImperativeHandle(ref, () => ({
    injectJavaScript: (code) => {
      try { iframeRef.current?.contentWindow?.eval(code); } catch {}
    },
  }));

  useEffect(() => {
    const handler = (event) => {
      if (onMessage && event.source === iframeRef.current?.contentWindow) {
        onMessage({ nativeEvent: { data: event.data } });
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onMessage]);

  if (!source?.html) return null;

  // Inject shim before </head> so window.ReactNativeWebView.postMessage
  // proxies to window.parent.postMessage, which the handler above receives.
  const shimmedHtml = source.html.replace(
    '</head>',
    `<script>
      window.ReactNativeWebView = {
        postMessage: function(data) { window.parent.postMessage(data, '*'); }
      };
    </script></head>`
  );

  return (
    <View style={style}>
      <iframe
        ref={iframeRef}
        srcDoc={shimmedHtml}
        style={{ width: '100%', height: '100%', border: 'none' }}
        onLoad={onLoad}
        sandbox="allow-scripts"
      />
    </View>
  );
});

WebView.displayName = 'WebView';
export { WebView };
export default WebView;
