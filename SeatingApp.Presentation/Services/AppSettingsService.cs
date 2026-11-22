using Microsoft.Extensions.Configuration;

namespace SeatingApp.Presentation.Services;

public class AppSettingsService
{
    public IConfiguration Configuration { get; }

    public AppSettingsService()
    {
        Configuration = new ConfigurationBuilder()
            .SetBasePath(AppContext.BaseDirectory)
            .AddJsonFile(
                "appsettings.json",
                optional: false,
                reloadOnChange: true)
            .Build();
    }
}