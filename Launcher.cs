using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Windows.Forms;

static class GraffitiLauncher
{
    [STAThread]
    static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        string root = AppDomain.CurrentDomain.BaseDirectory;
        string data = Environment.GetEnvironmentVariable("GRAFFITI_DATA");
        if (String.IsNullOrEmpty(data))
            data = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MT-Graffiti");
        string ready = Environment.GetEnvironmentVariable("GRAFFITI_READY_FILE");
        if (String.IsNullOrEmpty(ready))
            ready = Path.Combine(data, "desktop-" + Guid.NewGuid().ToString("N") + ".url.txt");

        string url = null;
        Process service = null;
        StreamWriter control = null;
        var form = new Form {
            Text = "MT Graffiti War V3.3", ClientSize = new Size(510, 176),
            StartPosition = FormStartPosition.CenterScreen,
            FormBorderStyle = FormBorderStyle.FixedDialog, MaximizeBox = false
        };
        var status = new Label {
            Text = "Đang khởi động máy chủ…", Location = new Point(18, 14),
            Size = new Size(475, 52)
        };
        var address = new TextBox {
            Location = new Point(18, 65), Width = 474, ReadOnly = true
        };
        var studio = new Button {
            Text = "Mở bảng điều khiển", Location = new Point(18, 105),
            Size = new Size(221, 39), Enabled = false
        };
        var live = new Button {
            Text = "Sao chép link OBS", Location = new Point(261, 105),
            Size = new Size(231, 39), Enabled = false
        };
        form.Controls.AddRange(new Control[] {status, address, studio, live});

        Action<string> open = target => {
            address.Text = target;
            try {
                using (Process browser = Process.Start(new ProcessStartInfo(target) {UseShellExecute = true})) { }
            } catch (Win32Exception) {
                status.Text = "Máy chủ đang chạy. Windows chặn mở trình duyệt tự động. Sao chép địa chỉ bên dưới để mở tay.";
                address.Focus();
                address.SelectAll();
            } catch (InvalidOperationException) {
                status.Text = "Máy chủ đang chạy. Sao chép địa chỉ bên dưới để mở trong trình duyệt.";
                address.Focus();
                address.SelectAll();
            }
        };
        studio.Click += (sender, args) => open(url + "/");
        live.Click += (sender, args) => {
            address.Text = url + "/overlay.html?renderer=obs";
            try {
                Clipboard.SetText(address.Text);
                status.Text = "Đã sao chép link OBS. Màn thử nằm trong bảng điều khiển.";
            } catch (System.Runtime.InteropServices.ExternalException) {
                address.Focus();
                address.SelectAll();
                status.Text = "Hãy sao chép địa chỉ trong ô bên dưới.";
            }
        };

        var timer = new Timer { Interval = 200 };
        var started = Stopwatch.StartNew();
        timer.Tick += (sender, args) => {
            if (url != null) return;
            if (started.Elapsed.TotalSeconds >= 20) {
                timer.Stop();
                status.Text = "Máy chủ chưa chạy. Kiểm tra cổng 3197, thư mục app, runtime và quyền ghi dữ liệu.";
                return;
            }
            try {
                if (!File.Exists(ready)) return;
                string result = File.ReadAllText(ready).Trim();
                Uri parsed;
                if (!Uri.TryCreate(result, UriKind.Absolute, out parsed) ||
                    parsed.Scheme != Uri.UriSchemeHttp || parsed.Host != "127.0.0.1") return;
                url = parsed.GetLeftPart(UriPartial.Authority);
            } catch (IOException) {
                return;
            } catch (UnauthorizedAccessException) {
                timer.Stop();
                status.Text = "Windows chặn đọc địa chỉ máy chủ trong thư mục dữ liệu.";
                return;
            }
            timer.Stop();
            studio.Enabled = true;
            live.Enabled = true;
            address.Text = url + "/";
            status.Text = "Máy chủ đang chạy. Giữ cửa sổ này mở trong khi dùng game.";
            if (Environment.GetEnvironmentVariable("GRAFFITI_NO_OPEN") != "1") open(address.Text);
        };

        form.Shown += (sender, args) => {
            try {
                Directory.CreateDirectory(data);
                var info = new ProcessStartInfo(Path.Combine(root, "runtime", "node.exe"), "server.mjs") {
                    UseShellExecute = false, CreateNoWindow = true, RedirectStandardInput = true,
                    WorkingDirectory = Path.Combine(root, "app")
                };
                info.EnvironmentVariables["GRAFFITI_DATA"] = data;
                info.EnvironmentVariables["GRAFFITI_PORT"] = Environment.GetEnvironmentVariable("GRAFFITI_PORT") ?? "3197";
                info.EnvironmentVariables["GRAFFITI_READY_FILE"] = ready;
                info.EnvironmentVariables["GRAFFITI_LAUNCHER_PIPE"] = "1";
                service = Process.Start(info);
                control = service.StandardInput;
                started.Restart();
                timer.Start();
            } catch (Exception e) {
                status.Text = "Không khởi động được máy chủ. " + e.Message;
            }
        };
        form.FormClosed += (sender, args) => {
            timer.Dispose();
            try { if (control != null) control.Dispose(); } catch (IOException) { }
            if (service != null) service.Dispose();
            try { File.Delete(ready); }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
        };
        Application.Run(form);
    }
}
