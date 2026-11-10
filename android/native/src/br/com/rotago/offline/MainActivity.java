package br.com.rotago.offline;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import java.io.ByteArrayInputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/** Offline Android shell: bundled assets and per-installation WebView storage only. */
public final class MainActivity extends Activity {
 private static final String HOST = "appassets.androidplatform.net";
 private static final String ORIGIN = "https://" + HOST;
 private static final int PICK_FILE = 101, SAVE_FILE = 102;
 private WebView web;
 private ValueCallback<Uri[]> pendingFiles;
 private String backupToSave;
 @Override public void onCreate(Bundle state) {
  super.onCreate(state);
  FrameLayout root = new FrameLayout(this);
  root.setBackgroundColor(Color.rgb(7,20,38));
  root.setOnApplyWindowInsetsListener((view,insets)->{view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets.consumeSystemWindowInsets();});
  setContentView(root);
  web=new WebView(this);
  root.addView(web,new FrameLayout.LayoutParams(-1,-1));
  web.setBackgroundColor(Color.rgb(7,20,38));
  WebSettings settings=web.getSettings();
  settings.setJavaScriptEnabled(true);
  settings.setDomStorageEnabled(true);
  settings.setAllowFileAccess(false);
  settings.setAllowContentAccess(true);
  settings.setAllowFileAccessFromFileURLs(false);
  settings.setAllowUniversalAccessFromFileURLs(false);
  settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  settings.setJavaScriptCanOpenWindowsAutomatically(false);
  settings.setSupportMultipleWindows(false);
  settings.setMediaPlaybackRequiresUserGesture(true);
  settings.setBlockNetworkLoads(true);
  WebView.setWebContentsDebuggingEnabled(false);
  android.webkit.CookieManager.getInstance().setAcceptCookie(false);
  web.addJavascriptInterface(new BackupBridge(),"RotaGoNative");
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return !local(request.getUrl());}
   @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
    Uri uri=request.getUrl();
    if(!local(uri))return blocked();
    String path=uri.getPath();
    if(path==null||path.equals("/"))path="/index.html";
    if(path.contains("..")||path.contains("\\"))return blocked();
    try {
     String filename=path.substring(1),mime=type(filename);
     Map<String,String> headers=new HashMap<>();
     headers.put("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'");
     headers.put("X-Content-Type-Options","nosniff");
     headers.put("Cache-Control","no-store");
     return new WebResourceResponse(mime,mime.startsWith("image/")?null:"UTF-8",200,"OK",headers,getAssets().open("www/"+filename));
    }catch(Exception e){return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",null,new ByteArrayInputStream(new byte[0]));}
   }
  });
  web.setWebChromeClient(new WebChromeClient(){
   @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
    if(pendingFiles!=null)pendingFiles.onReceiveValue(null);
    pendingFiles=callback;
    Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);
    intent.addCategory(Intent.CATEGORY_OPENABLE);
    intent.setType("*/*");
    intent.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"application/json","text/plain","application/octet-stream"});
    try{startActivityForResult(intent,PICK_FILE);}catch(Exception e){pendingFiles.onReceiveValue(null);pendingFiles=null;message("Não foi possível abrir o seletor de arquivos.");}
    return true;
   }
   @Override public boolean onJsAlert(WebView view,String url,String message,android.webkit.JsResult result){new AlertDialog.Builder(MainActivity.this).setTitle("RotaGo").setMessage(message).setPositiveButton("OK",(d,w)->result.confirm()).setOnCancelListener(d->result.cancel()).show();return true;}
   @Override public boolean onJsConfirm(WebView view,String url,String message,android.webkit.JsResult result){new AlertDialog.Builder(MainActivity.this).setTitle("RotaGo").setMessage(message).setPositiveButton("Continuar",(d,w)->result.confirm()).setNegativeButton("Cancelar",(d,w)->result.cancel()).setOnCancelListener(d->result.cancel()).show();return true;}
  });
  web.loadUrl(ORIGIN+"/index.html");
 }
 private static boolean local(Uri uri){return "https".equals(uri.getScheme())&&HOST.equals(uri.getHost())&&(uri.getPort()==-1||uri.getPort()==443);}
 private static WebResourceResponse blocked(){return new WebResourceResponse("text/plain","UTF-8",403,"Forbidden",null,new ByteArrayInputStream("Offline".getBytes(StandardCharsets.UTF_8)));}
 private static String type(String path){if(path.endsWith(".html"))return "text/html";if(path.endsWith(".js"))return "text/javascript";if(path.endsWith(".css"))return "text/css";if(path.endsWith(".png"))return "image/png";if(path.endsWith(".svg"))return "image/svg+xml";if(path.endsWith(".woff2"))return "font/woff2";if(path.endsWith(".json"))return "application/json";return "application/octet-stream";}
 private void message(String text){Toast.makeText(this,text,Toast.LENGTH_LONG).show();}
 public final class BackupBridge {
  @JavascriptInterface public void saveBackup(String json,String filename){
   if(json==null||json.length()>20*1024*1024)return;
   runOnUiThread(()->{
    if(web.getUrl()==null||!local(Uri.parse(web.getUrl())))return;
    if(backupToSave!=null){message("Conclua o backup em andamento.");return;}
    backupToSave=json;
    Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
    intent.addCategory(Intent.CATEGORY_OPENABLE);
    intent.setType("application/json");
    intent.putExtra(Intent.EXTRA_TITLE,filename!=null&&filename.matches("RotaGo-backup-[0-9-]+\\.json")?filename:"RotaGo-backup.json");
    try{startActivityForResult(intent,SAVE_FILE);}catch(Exception e){backupToSave=null;message("Não foi possível abrir o local de destino.");}
   });
  }
 }
 @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){
  super.onActivityResult(requestCode,resultCode,data);
  if(requestCode==PICK_FILE&&pendingFiles!=null){pendingFiles.onReceiveValue(resultCode==RESULT_OK&&data!=null&&data.getData()!=null?new Uri[]{data.getData()}:null);pendingFiles=null;}
  if(requestCode==SAVE_FILE){String content=backupToSave;backupToSave=null;if(resultCode==RESULT_OK&&data!=null&&data.getData()!=null&&content!=null){try(OutputStream out=getContentResolver().openOutputStream(data.getData(),"wt")){if(out==null)throw new Exception("Unavailable destination");out.write(content.getBytes(StandardCharsets.UTF_8));message("Backup salvo. Guarde-o em um local seguro.");}catch(Exception e){message("Não foi possível salvar o backup.");}}}
 }
 @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else new AlertDialog.Builder(this).setTitle("Fechar RotaGo?").setMessage("Seus registros salvos continuarão neste celular.").setPositiveButton("Fechar",(d,w)->finish()).setNegativeButton("Continuar",null).show();}
 @Override protected void onPause(){super.onPause();if(web!=null)web.onPause();}
 @Override protected void onResume(){super.onResume();if(web!=null)web.onResume();}
 @Override protected void onDestroy(){if(pendingFiles!=null)pendingFiles.onReceiveValue(null);if(web!=null){web.removeJavascriptInterface("RotaGoNative");web.destroy();}backupToSave=null;super.onDestroy();}
}
