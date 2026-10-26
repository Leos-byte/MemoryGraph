cmake_minimum_required(VERSION 3.20)

project(MemGraph VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTOUIC ON)
set(CMAKE_AUTORCC ON)

find_package(QT NAMES Qt6 Qt5 REQUIRED COMPONENTS Widgets Network Sql LinguistTools)
find_package(Qt${QT_VERSION_MAJOR} REQUIRED COMPONENTS Widgets Network Sql LinguistTools)

set(MEMGRAPH_SOURCES
    src/main.cpp
    src/api/AiClient.cpp
    src/api/AiClient.h
    src/core/AppSettings.cpp
    src/core/AppSettings.h
    src/core/GraphStore.cpp
    src/core/GraphStore.h
    src/core/GraphTypes.h
    src/core/MarkdownExporter.cpp
    src/core/MarkdownExporter.h
    src/core/SecretStore.cpp
    src/core/SecretStore.h
    src/core/TemplateEngine.cpp
    src/core/TemplateEngine.h
    src/core/TextSanitizer.cpp
    src/core/TextSanitizer.h
    src/ui/GraphCanvas.cpp
    src/ui/GraphCanvas.h
    src/ui/GraphNodeItem.cpp
    src/ui/GraphNodeItem.h
    src/ui/MainWindow.cpp
    src/ui/MainWindow.h
    src/ui/SettingsDialog.cpp
    src/ui/SettingsDialog.h
    src/ui/TemplateDialog.cpp
    src/ui/TemplateDialog.h
    src/ui/UiTheme.cpp
    src/ui/UiTheme.h
    src/ui/SafeMarkdownBrowser.h
)

if(QT_VERSION_MAJOR EQUAL 6)
    qt_add_executable(MemGraph ${MEMGRAPH_SOURCES})
else()
    add_executable(MemGraph ${MEMGRAPH_SOURCES})
endif()

target_include_directories(MemGraph PRIVATE src)

target_link_libraries(MemGraph PRIVATE
    Qt${QT_VERSION_MAJOR}::Widgets
    Qt${QT_VERSION_MAJOR}::Network
    Qt${QT_VERSION_MAJOR}::Sql
)

set(MEMGRAPH_TS_FILES
    i18n/memgraph_zh_CN.ts
    i18n/memgraph_en_US.ts
)

foreach(ts_file IN LISTS MEMGRAPH_TS_FILES)
    get_filename_component(ts_name "${ts_file}" NAME_WE)
    set(qm_file "${CMAKE_CURRENT_BINARY_DIR}/i18n/${ts_name}.qm")
    list(APPEND MEMGRAPH_QM_FILES "${qm_file}")
    add_custom_command(
        OUTPUT "${qm_file}"
        COMMAND ${CMAKE_COMMAND} -E make_directory "${CMAKE_CURRENT_BINARY_DIR}/i18n"
        COMMAND Qt${QT_VERSION_MAJOR}::lrelease "${CMAKE_CURRENT_SOURCE_DIR}/${ts_file}" -qm "${qm_file}"
        DEPENDS "${CMAKE_CURRENT_SOURCE_DIR}/${ts_file}"
        VERBATIM
    )
endforeach()

add_custom_target(memgraph_translations ALL DEPENDS ${MEMGRAPH_QM_FILES})
add_dependencies(MemGraph memgraph_translations)

install(TARGETS MemGraph RUNTIME DESTINATION bin)
install(FILES ${MEMGRAPH_QM_FILES} DESTINATION i18n)

include(CTest)
option(MEMGRAPH_BUILD_TESTS "Build MemGraph automated tests" ON)
if(MEMGRAPH_BUILD_TESTS)
    find_package(Qt${QT_VERSION_MAJOR} QUIET COMPONENTS Test)
    if(TARGET Qt${QT_VERSION_MAJOR}::Test)
        add_executable(MemGraphCoreTests
            tests/test_template_engine.cpp
            src/api/AiClient.cpp
            src/api/AiClient.h
            src/core/GraphStore.cpp
            src/core/GraphStore.h
            src/core/TemplateEngine.cpp
            src/core/TemplateEngine.h
            src/core/TextSanitizer.cpp
            src/core/TextSanitizer.h
            src/core/GraphTypes.h
        )
        target_include_directories(MemGraphCoreTests PRIVATE src)
        target_link_libraries(MemGraphCoreTests PRIVATE Qt${QT_VERSION_MAJOR}::Test Qt${QT_VERSION_MAJOR}::Sql Qt${QT_VERSION_MAJOR}::Network)
        add_test(NAME MemGraphCoreTests COMMAND MemGraphCoreTests)
        add_executable(MemGraphSecurityUiTests tests/test_security_ui.cpp)
        target_include_directories(MemGraphSecurityUiTests PRIVATE src)
        target_link_libraries(MemGraphSecurityUiTests PRIVATE Qt${QT_VERSION_MAJOR}::Test Qt${QT_VERSION_MAJOR}::Widgets)
        add_test(NAME MemGraphSecurityUiTests COMMAND MemGraphSecurityUiTests)
        set_tests_properties(MemGraphSecurityUiTests PROPERTIES ENVIRONMENT "QT_QPA_PLATFORM=offscreen")
    endif()
endif()
