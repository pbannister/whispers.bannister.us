module.exports = function (eleventyConfig) {
    // Explicitly copy site.in/assets -> site.out/assets
    eleventyConfig.addPassthroughCopy({ "site.in/assets": "assets" });

    // Pass standalone PHP files verbatim
    eleventyConfig.addPassthroughCopy({ "site.in/api": "api" });

    // Watch PHP files for dev reloads
    eleventyConfig.addWatchTarget("site.in/**/*.php");

    return {
        dir: {
            input: "site.in",
            output: "site.out",
            includes: "_includes",
            layouts: "_includes/layouts"
        },
        templateFormats: ["njk", "md", "html"],
        htmlTemplateEngine: "njk",
        markdownTemplateEngine: "njk"
    };
};
