const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (result) => {
    if (result.modResults.language !== 'groovy') throw new Error('LoopTodo release signing requires Groovy Gradle');
    let source = result.modResults.contents;
    if (source.includes('LOOPTODO_RELEASE_STORE_FILE')) return result;

    source = source.replace(
      'android {',
      `def releaseStoreFile = findProperty('LOOPTODO_RELEASE_STORE_FILE') ?: System.getenv('LOOPTODO_RELEASE_STORE_FILE')
def releaseStorePassword = findProperty('LOOPTODO_RELEASE_STORE_PASSWORD') ?: System.getenv('LOOPTODO_RELEASE_STORE_PASSWORD')
def releaseKeyAlias = findProperty('LOOPTODO_RELEASE_KEY_ALIAS') ?: System.getenv('LOOPTODO_RELEASE_KEY_ALIAS')
def releaseKeyPassword = findProperty('LOOPTODO_RELEASE_KEY_PASSWORD') ?: System.getenv('LOOPTODO_RELEASE_KEY_PASSWORD')

gradle.taskGraph.whenReady { graph ->
    if (graph.allTasks.any { it.name.toLowerCase().contains('release') } &&
        !(releaseStoreFile && releaseStorePassword && releaseKeyAlias && releaseKeyPassword)) {
        throw new GradleException('LoopTodo release signing properties are required for release tasks')
    }
}

android {`,
    );
    source = source.replace(
      `        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }`,
      `        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (releaseStoreFile) storeFile file(releaseStoreFile)
            storePassword releaseStorePassword
            keyAlias releaseKeyAlias
            keyPassword releaseKeyPassword
        }
    }`,
    );
    source = source.replace(
      `            signingConfig signingConfigs.debug
            def enableShrinkResources`,
      `            signingConfig signingConfigs.release
            def enableShrinkResources`,
    );
    result.modResults.contents = source;
    return result;
  });
};

