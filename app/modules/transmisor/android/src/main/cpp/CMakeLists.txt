cmake_minimum_required(VERSION 3.22.1)
project(transmisorlog C)

add_library(transmisorlog SHARED registro_seguro.c)
target_link_libraries(transmisorlog log dl)
