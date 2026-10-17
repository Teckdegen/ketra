plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

import java.util.Properties

val keystorePropsFile = rootProject.file("keystore/keystore.properties")
val keystoreProps = Properties().apply {
    if (keystorePropsFile.exists()) keystorePropsFile.inputStream().use { load(it) }
}

android {
    namespace = "network.ketra.wallet"
    compileSdk = 35

    defaultConfig {
        applicationId = "network.ketra.wallet"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "0.1.1"
    }

    signingConfigs {
        create("release") {
            storeFile = rootProject.file("keystore/ketra-release.jks")
            storePassword = keystoreProps.getProperty("storePassword")
                ?: System.getenv("KETRA_KEYSTORE_PASSWORD")
                ?: "ketra-release-2026"
            keyAlias = keystoreProps.getProperty("keyAlias")
                ?: System.getenv("KETRA_KEY_ALIAS")
                ?: "ketra"
            keyPassword = keystoreProps.getProperty("keyPassword")
                ?: System.getenv("KETRA_KEY_PASSWORD")
                ?: "ketra-release-2026"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            isDebuggable = false
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.webkit:webkit:1.12.1")
}
